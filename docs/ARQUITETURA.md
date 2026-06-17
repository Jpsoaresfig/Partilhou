# Arquitetura — Partilhou

Documento técnico do sistema de afiliação C2C com escrow e split de pagamento.

## 1. Visão geral

```
┌────────────┐   HTTPS    ┌──────────────────────────┐   RPC (service_role)   ┌─────────────────┐
│  Cliente   │ ─────────► │  Next.js (Route Handlers)│ ─────────────────────► │  Postgres (app.*)│
│ (browser)  │ ◄───────── │  + @supabase/ssr (RLS)   │ ◄───────────────────── │  funções ACID    │
└────────────┘            └──────────┬───────────────┘                        └────────┬─────────┘
                                     │ webhooks                                          │ pg_cron
                                     ▼                                                   ▼
                            ┌─────────────────┐                               app.auto_release_due()
                            │  Mercado Pago    │
                            └─────────────────┘
```

- **Camada de aplicação (Next.js):** valida entrada (Zod), autentica (Supabase),
  orquestra. Operações de leitura usam o cliente **com RLS** (como o usuário).
- **Camada financeira (Postgres):** funções `SECURITY DEFINER` no schema privado
  `app`. São o **único** caminho que move dinheiro. Atômicas e idempotentes.
- **Gateway:** apenas cobra o comprador. A plataforma é a recebedora única
  (modelo de escrow). Repasses saem da carteira interna via payout.

## 2. Modelo de dados

| Tabela | Papel | Observações |
|---|---|---|
| `auth.users` | Autenticação | Gerida pelo Supabase Auth (senha hash, JWT, refresh rotativo). |
| `profiles` | Dados não sensíveis | Legível por autenticados (nome do vendedor). |
| `profiles_private` | PII | Documento (CPF/CNPJ) + telefone. RLS: só o dono. `document_hash` único. |
| `products` | Anúncios | Preço em centavos, comissão em bps. Trigger valida limites. |
| `affiliate_links` | Atribuição | `tracking_code` único; 1 por (afiliado, produto). |
| `affiliate_clicks` | Analytics | IP guardado como HMAC. |
| `orders` | Pedidos | **Snapshot** do split congelado. Máquina de estados tripla. |
| `wallets` | Saldos | `pendente`/`disponível` por usuário. Projeção do ledger. |
| `ledger_entries` | Razão | Append-only, partidas dobradas (soma do grupo = 0). |
| `withdrawals` | Saques | Débito atômico do disponível. |
| `payment_events` | Idempotência | Único `(provider, event_id)`. Auditoria de webhooks. |
| `platform_settings` | Config | Taxa, limites de comissão, janela de escrow, cookie. |

### Por que centavos e basis points?
Aritmética monetária com `float`/`double` acumula erro binário (`0.1 + 0.2 ≠ 0.3`).
Usamos **inteiros (bigint) em centavos** e **basis points** (1500 = 15,00%) para
exatidão. O arredondamento do split usa `floor` por beneficiário e a sobra fica
com o vendedor — a soma **sempre** fecha com o total (constraint `orders_split_sums`).

## 3. Máquina de estados do pedido

```
payment_status:  pendente → aprovado → concluido
                              │  └────────────► em_disputa → (aprovado→concluido | estornado)
                              └────────────────────────────► estornado

funds_state:     aguardando_pagamento → retido → liberado
                                            └──────────────► estornado

delivery_status: aguardando_envio → em_transito → entregue
```

Transições só acontecem dentro das funções `app.*`, que validam o estado de
origem. Estados inválidos resultam em erro (HTTP 409).

## 4. Ledger de partidas dobradas

Cada movimento gera lançamentos agrupados por `entry_group`. **Invariante:** a soma
(com sinal) de cada grupo é **zero** — validado por *constraint trigger* deferida.

| Operação | Lançamentos |
|---|---|
| **Captura** (pagamento aprovado) | `externo −T` · `usuario_pendente +líquido(vendedor)` · `usuario_pendente +comissão(afiliado)` · `plataforma_pendente +taxa` |
| **Liberação** | para cada beneficiário: `*_pendente −X` · `*_disponivel +X` |
| **Estorno** | `*_pendente −X` (revert) · `externo +T` |
| **Saque** | `usuario_disponivel −V` · `externo +V` |

As carteiras (`wallets`) são **projeções** atualizadas na mesma transação.
`app.reconcile_wallet(user)` recomputa saldo a partir do ledger e compara — uma
divergência indica bug e é detectável.

## 5. Idempotência de webhooks (dupla camada)

```
1. Assinatura HMAC válida?  ──não──► 401
            │sim
2. record_payment_event(provider, event_id)  (UNIQUE)
            │
   já processado? ──sim──► 200 (não reprocessa)
            │não / falha anterior
3. getPayment() no gateway  (status AUTORITATIVO, não confia no payload)
            │
4. confirm_payment() / refund_order()
   └─ guard: só age se funds_state == estado esperado  ◄── 2ª camada
            │
   sucesso → 200 ;  erro → 500 (gateway reentrega)
```

Mesmo que a mesma notificação chegue 10 vezes — ou duas ao mesmo tempo (o
`SELECT ... FOR UPDATE` serializa) — a comissão é creditada **uma única vez**.

## 6. Concorrência e ACID

- Cada função financeira roda numa transação implícita (atômica).
- `SELECT ... FOR UPDATE` na carteira e no pedido evita *race conditions*
  (ex.: dois saques simultâneos, dupla liberação).
- `auto_release_due()` usa `FOR UPDATE SKIP LOCKED` para processar lotes sem
  travar nem reprocessar o mesmo pedido em execuções concorrentes do cron.

## 7. Segurança

- **RLS** habilitada em todas as tabelas `public`. Padrão `TO authenticated` +
  predicado de posse `(select auth.uid()) = owner` (evita IDOR/BOLA).
- **Funções financeiras** ficam no schema **privado `app`**; `anon`/`authenticated`
  não têm `USAGE`. Só o `service_role` (servidor) executa. Autorização de papel
  (vendedor/comprador) é checada **dentro** das funções por `p_actor_id`.
- **PII** isolada em `profiles_private`; documento exposto só como hash para
  deduplicação. Recomenda-se Vault para cifrar em coluna em produção.
- **Admin** identificado por `app_metadata.is_admin` (não editável pelo usuário),
  nunca por `user_metadata`.
- **Segredos** (service_role, token do gateway) nunca sob `NEXT_PUBLIC_`.
- **Webhook** validado por assinatura com o **corpo bruto** (sem parser global).

## 8. Liberação automática (mecanismo de defesa)

Ao marcar envio, define-se `auto_release_at = now() + escrow_auto_release_days`.
O cron `partilhou_auto_release` roda a cada 10 min e libera pedidos `retido` cujo
prazo venceu e que **não** estão em disputa — garantindo que o vendedor receba
mesmo se o comprador sumir. Se `pg_cron` não estiver disponível, agende
`app.auto_release_due()` externamente (Edge Function + Scheduler).

## 9. Extensões futuras

- Disbursement real (PIX/refund) no gateway para saques e estornos.
- KYC e verificação de conta como pré-condição de saque.
- Notificações (e-mail/push) por transição de estado.
- Painel de mediação de disputas com upload de provas (Storage + RLS).
- Antifraude (limites por conta, score de risco).
