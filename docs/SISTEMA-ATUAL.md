# Partilhou — O que já existe no sistema

> Documento técnico-descritivo do **estado atual** do código (não é visão/roadmap).
> Objetivo: mapear a stack completa e tudo que a plataforma **já faz hoje**.
> Base: leitura direta do repositório (migrations `supabase/`, rotas `src/app/api`, libs e componentes).

---

## 1. Em uma frase

Marketplace **C2C** (pessoa-para-pessoa) em **Next.js + Supabase (Postgres)**, com **escrow** (pagamento retido até a entrega), **split automático** entre vendedor/afiliado/plataforma, **programa de afiliados** por link de rastreio, **carteira digital** com ledger de partidas dobradas, e integração de pagamento com **Mercado Pago** (com provider "mock" para desenvolvimento).

O núcleo financeiro está **implementado e testado**: criação de pedido, captura, escrow, liberação, estorno, disputa, saque e liberação automática por cron.

---

## 2. Stack tecnológica

| Camada | Tecnologia | Observações |
|---|---|---|
| **Frontend** | Next.js 15.5 (App Router), React 18.3, TypeScript 5.6 | Server Components + Route Handlers. CSS próprio (`globals.css`) com tema claro/escuro via `data-theme`. Sem framework de UI externo. |
| **Backend (API)** | Next.js Route Handlers (`src/app/api/**`) | Validação com **Zod**. Autenticação via `@supabase/ssr`. Orquestra; **não move dinheiro diretamente**. |
| **Auth** | Supabase Auth | JWT + refresh rotativo, cookies via `@supabase/ssr`. Middleware de sessão (`src/lib/supabase/middleware.ts`). |
| **Banco de dados** | PostgreSQL (Supabase) | RLS em todas as tabelas `public`. Funções financeiras em schema privado `app` (SECURITY DEFINER). |
| **Pagamentos** | Mercado Pago (`PAYMENT_PROVIDER=mercadopago`) ou Mock | Abstraído por interface `PaymentProvider`. Webhook com assinatura HMAC. |
| **Jobs** | `pg_cron` | Liberação automática de escrow (`app.auto_release_due()`). |
| **Storage** | Supabase Storage | Buckets de imagens de produto e avatares. |
| **Testes** | Vitest | Testes da aritmética monetária (`src/lib/__tests__/money.test.ts`). |
| **Validação de schema** | Zod (`src/lib/validation.ts`) | Toda entrada de API passa por schema. |

**Dependências de produção** (enxutas, de propósito): `@supabase/ssr`, `@supabase/supabase-js`, `next`, `react`, `react-dom`, `zod`. Sem ORM, sem libs de UI, sem state manager externo.

---

## 3. Modelo de dados (PostgreSQL)

São **25 migrations** versionadas em `supabase/migrations/`. Tabelas principais:

### Núcleo financeiro / transacional
| Tabela | Papel | Pontos críticos |
|---|---|---|
| `profiles` | Dados públicos do usuário (nome, reputação, região, avatar, presença). | Legível por autenticados. |
| `profiles_private` / dados sensíveis | PII (documento, telefone). | RLS estrita: só o dono. |
| `products` | Anúncios. Preço em **centavos**, comissão em **bps**. | Trigger valida limites de comissão. View `products_with_split` simula o split. |
| `affiliate_links` | Atribuição. `tracking_code` único por (afiliado, produto). | Base do programa de afiliados. |
| `orders` | Pedidos. **Snapshot congelado** do split + 3 máquinas de estado. | Constraints financeiras (ver §5). |
| `wallets` | Carteira por usuário: `pendente` + `disponivel`. | Saldos **nunca negativos** (CHECK). Projeção do ledger. |
| `wallet_payout_methods` | Dados bancários/PIX para saque. | RLS estrita. |
| `ledger_entries` | Razão **append-only**, partidas dobradas. | Soma de cada grupo = 0 (trigger diferida). UPDATE/DELETE bloqueados. |
| `withdrawals` | Saques (payouts). | Débito atômico do disponível. |
| `payment_events` | Idempotência de webhook. | Único `(provider, event_id)`. |
| `platform_settings` | Config tunável sem deploy. | Taxa, limites de comissão, janela de escrow, cookie de afiliado. |

### Produto / comunidade / confiança
| Tabela | Papel |
|---|---|
| `ratings` | Reputação 360° (comprador↔vendedor↔afiliado, e vendedor→comprador). |
| `chat` (conversas + mensagens) | Chat afiliado↔vendedor / partes do pedido. |
| `notifications` | Notificações por transição de estado. |
| `groups`, `group_members`, `group_posts`, `group_post_likes` | Feature "Grupos" (comunidades) — atrás de feature flag. |
| `problem_reports` | Denúncias/reportes (página `/reportar`). |
| Atributos de produto | Campos extras por categoria (`product_attributes`). |

### Convenções de robustez (em todo o schema)
- **Dinheiro sempre em centavos (`bigint`)** — nunca float. Sem erro de arredondamento.
- **Percentuais em basis points** (1500 = 15,00%) — inteiro, exato.
- **Enums** para estados: `payment_status`, `delivery_status`, `funds_state`, `ledger_account`, `ledger_type`, `withdrawal_status`, `product_status`, `account_status`.
- **Idempotência** por chave única de evento + guarda de estado.

---

## 4. Arquitetura de dinheiro (o coração do sistema)

### Carteira + Razão (ledger) de partidas dobradas
- Cada usuário tem **uma carteira** (`balance_pending_cents` / `balance_available_cents`).
- Toda movimentação gera lançamentos em `ledger_entries`, agrupados por `entry_group`.
- **INVARIANTE:** a soma (com sinal) de cada `entry_group` é **zero** — validada por **constraint trigger diferida** (no commit), permitindo inserir os dois lados em qualquer ordem.
- As carteiras são **projeções** do ledger, atualizadas na mesma transação.
- `app.reconcile_wallet(user)` recomputa saldo a partir do ledger e compara com a carteira — divergência indica bug e é detectável.

### Contas do ledger
`externo` (mundo externo: comprador entra, saque sai) · `usuario_pendente` / `usuario_disponivel` (carteira do usuário) · `plataforma_pendente` / `plataforma_disponivel` (receita da plataforma).

### Lançamentos por operação
| Operação | Lançamentos (somam 0) |
|---|---|
| **Captura** (pagamento aprovado) | `externo −total` · `usuario_pendente(vendedor) +líquido` · `usuario_pendente(afiliado) +comissão` · `plataforma_pendente +taxa` |
| **Liberação** | para cada beneficiário: `*_pendente −X` · `*_disponivel +X` |
| **Estorno** | reverte os pendentes · `externo +total` (devolve ao comprador) |
| **Saque** | `usuario_disponivel −V` · `externo +V` |

### Funções financeiras (schema privado `app`, SECURITY DEFINER)
Todas atômicas, idempotentes por guarda de estado, com `FOR UPDATE` nas linhas:

- `app.create_order(buyer, product, affiliate_code?)` — cria o pedido com split **congelado** (snapshot). Resolve o afiliado pelo código; ignora se for inválido ou se for o próprio comprador/vendedor (vira venda direta, comissão = 0).
- `app.confirm_payment(order, provider, payment_id)` — captura. Move valores para o **saldo pendente** (escrow). Só age se `funds_state = aguardando_pagamento`.
- `app.mark_shipped(order, actor, tracking?)` — vendedor marca envio. Inicia a contagem do escrow (`auto_release_at = now() + N dias`).
- `app.confirm_delivery(order, actor)` — comprador confirma → chama `release_funds`.
- `app.release_funds(order)` — move pendente → disponível (vendedor, afiliado, plataforma). Bloqueia se em disputa. Idempotente.
- `app.open_dispute(order, actor, reason)` — comprador abre disputa. Congela fundos (zera `auto_release_at`).
- `app.resolve_dispute(order, outcome)` — mediação: `liberar` ou `estornar`. (Autorização de admin feita na API.)
- `app.refund_order(order)` — estorno ao comprador (pendente → externo). Idempotente.
- `app.auto_release_due()` — job de cron: libera pedidos `retido` cujo prazo venceu e que **não** estão em disputa. Usa `FOR UPDATE SKIP LOCKED` (processa lote sem travar).
- `app.request_withdrawal(user, amount, pix_key)` — saca do disponível. Débito atômico (saldo nunca negativo / sem saque duplo).
- `app.fail_withdrawal(id, reason)` — reverte saque que falhou no gateway.

---

## 5. Máquina de estados do pedido

Três estados **ortogonais** na mesma `order`:

```
payment_status:  pendente → aprovado → concluido
                              │   └──────────► em_disputa → (concluido | estornado)
                              └─────────────────────────► estornado

funds_state:     aguardando_pagamento → retido → liberado
                                           └──────────────► estornado

delivery_status: aguardando_envio → em_transito → entregue
```

Transições só ocorrem **dentro** das funções `app.*`, que validam o estado de origem (estado inválido = erro, nada muda).

### Constraints financeiras críticas (em `orders`)
- `orders_split_sums`: `commission_cents + platform_fee_cents + seller_net_cents = amount_total_cents` — **o split sempre fecha**.
- `orders_buyer_not_seller`: comprador ≠ vendedor.
- `orders_affiliate_distinct`: afiliado ≠ comprador e ≠ vendedor.
- Em `wallets`: `balance_*_cents >= 0` — saldo nunca negativo.

---

## 6. Fluxo da transação (fim a fim, como está hoje)

1. **Compra** → `POST /api/checkout` (ou `/api/orders`) chama `app.create_order` → pedido em `pendente / aguardando_pagamento`, com split congelado.
2. **Pagamento** → gateway cobra o comprador. **Webhook** `POST /api/webhooks/mercadopago` processa a aprovação.
3. **Captura** → `app.confirm_payment` → `aprovado / retido`. Dinheiro vai pro **saldo pendente** (escrow).
4. **Envio** → vendedor em `POST /api/orders/[id]/ship` → `em_transito`, inicia `auto_release_at`.
5. **Recebimento** → comprador em `POST /api/orders/[id]/confirm-delivery` → `entregue` → `release_funds` → `liberado / concluido`. (Ou **liberação automática** pelo cron se o comprador sumir.)
6. **Saque** → beneficiário em `POST /api/wallet/withdraw` → débito do disponível + payout.
- **Disputa** (a qualquer momento com fundos retidos): `POST /api/orders/[id]/dispute` congela; admin resolve em `/api/admin/orders/[id]/resolve` (liberar/estornar).

---

## 7. Webhooks e idempotência (Mercado Pago)

O webhook (`src/app/api/webhooks/mercadopago/route.ts`) tem **dupla camada** de segurança:

1. **Assinatura HMAC** validada com o **corpo bruto**. Inválido → `401`.
2. **Registro idempotente** do evento (`record_payment_event`, único por `provider+event_id`). Reentrega já processada → `200` sem reprocessar.
3. **Status autoritativo** consultado no gateway (`getPayment`) — **nunca confia no payload** recebido.
4. **Transição idempotente** (`confirm_payment` / `refund_order`): mesmo com reentrega/concorrência, o guard de `funds_state` impede crédito duplo.
5. Falha de processamento → `500` (gateway reentrega).

A camada de pagamento é abstraída (`src/lib/payments/`): interface `PaymentProvider` com implementações **`mercadopago`** e **`mock`** (dev), selecionadas por `PAYMENT_PROVIDER`.

---

## 8. Sistema de afiliados (estado atual)

- Afiliado gera um link para um produto (`POST /api/affiliate/links`) → cria `affiliate_links` com `tracking_code` único por (afiliado, produto).
- Divulgação via link de rastreio → `GET /api/r/[code]` (redirect com atribuição).
- **Atribuição:** o código de rastreio é passado no checkout; `create_order` resolve o afiliado. Cookie de atribuição com validade configurável (`affiliate_cookie_days`, padrão 30).
- **Comissão:** definida pelo vendedor no produto (`commission_bps`), dentro dos limites globais; **congelada** no pedido. Venda sem afiliado → comissão 0 (vendedor fica com a fatia).
- **Pagamento da comissão:** entra em `pendente` na captura, vira `disponivel` só na liberação. Estorno antes disso → comissão não é paga.
- **Antifraude (atual):** garantido por constraint — afiliado não pode ser comprador nem vendedor; auto-afiliação é ignorada em `create_order`.
- Existe também (modelado em migrations anteriores) a feature de **faixa de preço + comissão variável** (linear/tiers) via `resolve_commission_bps`.

---

## 9. Funcionalidades de produto (o que o usuário vê)

### Inventário de páginas (`src/app/`)
- **Home** `/` — listagem com **busca + filtros** (categoria, UF, faixa de preço, ordenação) e hero.
- **Auth** `/login`, `/registrar` — com aceite de termos/privacidade e declaração 18+.
- **Vender** `/vender` — cadastro de anúncio (campos por categoria, preço, comissão, imagens, CEP via ViaCEP).
- **Produto** `/produto/[id]` e `/produto/[id]/editar` — detalhe, ações de compra, reputação, botão de chat.
- **Painel** `/painel` — produtos e pedidos do usuário.
- **Carteira** `/carteira` — saldos (pendente/disponível) e saque.
- **Pedido** `/pedidos/[id]` — acompanhamento do pedido + avaliação.
- **Loja pública** `/loja/[id]` — perfil público do vendedor com reputação nos 3 papéis.
- **Chat** `/chat` e `/chat/[id]` — lista de conversas e thread (envio + polling + marcação de lidas).
- **Notificações** `/notificacoes` — com marcar todas como lidas.
- **Perfil** `/perfil` — dados, avatar, presença.
- **Grupos** `/grupos`, `/grupos/criar` — comunidades (atrás de feature flag).
- **Admin** `/admin` — painel com abas (KPIs, usuários, pedidos, produtos, financeiro, avaliações, reportes, disputas, grupos, afiliados, configurações).
- **Legais** `/termos`, `/privacidade`, `/reportar`.

### Inventário de rotas de API (`src/app/api/`)
- **Auth:** `login`, `register`, `logout`.
- **Produtos:** `POST /products`, `/products/[id]`.
- **Afiliados:** `POST /affiliate/links`, `GET /r/[code]` (redirect/tracking).
- **Pedidos:** `POST /orders`, `/orders/[id]/ship`, `/confirm-delivery`, `/dispute`, `/rate`.
- **Checkout:** `POST /checkout`.
- **Carteira:** `GET /wallet`, `POST /wallet/withdraw`.
- **Pagamentos:** `POST /webhooks/mercadopago`, `POST /dev/mock-pay` (dev).
- **Chat:** `POST /chat/start`.
- **Notificações:** `POST /notifications/read`.
- **Reportes:** `POST /reports`.
- **Grupos:** `POST /grupos`, `POST|DELETE /grupos/[id]/participar`.
- **Admin:** `/admin/orders/[id]/resolve`, `/admin/reports/[id]/resolve`, `/admin/settings`.
- **Infra:** `GET /health`.

### Componentes notáveis (`src/components/`)
`ProductCard`, `SellForm`, `EditProductForm`, `PricingFields`, `AttributeFields`, `ImageUploader`, `OrderActions`, `StatusBadge`, `WithdrawForm`, `ResolveDispute`, `Reputation`, `RatingForm`, `ChatButton`/`ChatThread`/`ChatBubble`, `Navbar`, `MobileTabBar`, `SiteFooter`, `ThemeToggle`, `AuthForm`, `ProfileForm`, `ReportForm`, `GroupJoinButton`/`CreateGroupForm`, `FeatureToggle`, `ResolveReport`, `TrustFab`, `icons`.

---

## 10. Segurança (o que já está em vigor)

- **RLS** habilitada em todas as tabelas `public`, padrão `TO authenticated` + posse (`auth.uid() = owner`) — previne IDOR/BOLA.
- **Funções financeiras** isoladas no schema privado **`app`**; `anon`/`authenticated` **não têm `USAGE`**. Só o `service_role` (servidor) executa. Papel (vendedor/comprador) checado **dentro** das funções por `p_actor_id`.
- **PII** isolada (documento exposto só como hash para dedupe).
- **Admin** identificado por `app_metadata.is_admin` (não editável pelo usuário).
- **Segredos** (service_role, token do gateway) nunca sob `NEXT_PUBLIC_`.
- **Webhook** validado por assinatura com corpo bruto.
- **Ledger append-only** + invariante de soma zero + reconciliação de carteira.

---

## 11. O que **não** existe ainda (lacunas conhecidas)

Para alinhar expectativa com a direção discutida (alto valor / verificação):

- **Verificação de produto** — **implementada como classificação automática NÃO bloqueante** (migrations `product_verification` → `classify_and_nonblocking_gate`): todo anúncio entra na hora e recebe selo + `trust_score` (0–100) calculado por `src/lib/trust.ts` (fotos, descrição estruturada, IMEI/Luhn) via `app.classify_product`. Status: `approved` (🟢 Verificado) / `partial` (🟡) / `unverified` (🔴) / `rejected` (admin, anti-fraude). **A validação não barra a venda** — só `rejected` não gera pedido (gate em `create_order`); a home rankeia por `trust_score`. IMEI estruturado com índice único anti-duplicado; admin pode reclassificar/reprovar (`app.review_product`). **Ainda falta**: verificação **física** (hub/inspeção), laudo com fotos, **API automática de IMEI** (consulta de bloqueio/roubo ainda é externa) e a verificação como estado próprio na máquina de entrega (fluxo de duas pernas).
- **Split em PSP regulado** — hoje o modelo é **recebedor único** (custódia na plataforma + payout). Disbursement real (PIX/refund no gateway) está marcado como extensão.
- **KYC/verificação de conta** como pré-condição de saque — não implementado.
- **Atribuição de afiliado por cupom** — hoje é por link/cookie de rastreio.
- **Antifraude avançado** (device fingerprint, score, velocity) — apenas as travas estruturais por constraint.
- **Logística de duas pernas, multi-hub, etiquetas** — inexistente.
- **Notificações por e-mail/push** — apenas notificações in-app.
- **Painel de mediação com upload de provas** — disputa é resolvida sem anexos.

---

## 12. Resumo executivo (TL;DR)

O que está **pronto e robusto**: o **motor financeiro** (escrow, ledger double-entry, split congelado, idempotência de webhook, liberação automática, saque atômico, reconciliação), o **marketplace C2C** (anúncio, busca, compra, painel), **afiliados por link**, **reputação 360°**, **chat**, **notificações**, **grupos** (flag) e **painel admin** completo — tudo sobre Next.js + Supabase com RLS e funções `app.*` SECURITY DEFINER.

O que **falta** para a tese de alto valor: **verificação de produto** (IMEI/inspeção) integrada à máquina de estados, **split via PSP regulado**, **KYC** e **antifraude** mais fortes.
