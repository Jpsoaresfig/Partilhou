# Partilhou — Marketplace C2C com Afiliação, Escrow e Split de Pagamento

Plataforma onde um **Vendedor** anuncia produtos usados e define uma comissão; um
**Afiliado** gera um link e realiza a venda; a plataforma atua como **intermediária
de confiança (Escrow)**, retendo o pagamento do **Comprador** e repassando
automaticamente vendedor + afiliado após a entrega confirmada.

> **Estado atual:** backend + banco de dados **e a UI web completa** estão
> implementados e funcionais ponta-a-ponta em modo `mock` (sem credenciais de
> gateway): cadastro/login, anúncios, links de afiliado, checkout com **endereço
> de entrega**, pagamento simulado, envio, confirmação, escrow/split, carteira e
> saque. Os itens que dependem de contas externas (PIX real, KYC) estão listados
> em [Pendências para produção](#pendências-para-produção-claramente-marcadas-no-código).

- **Stack:** Next.js 15 (App Router, TypeScript) · Supabase (Postgres + Auth + RLS) · Mercado Pago
- **Arquitetura detalhada:** [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md)

---

## Princípios de robustez

| Risco | Como é tratado |
|---|---|
| Erro de arredondamento em dinheiro | Tudo em **centavos (bigint)**; percentuais em **basis points**. Nunca float. |
| Comissão creditada em dobro (webhook repetido) | **Idempotência dupla**: chave única `(provider, event_id)` + guarda de `funds_state` nas funções. |
| Afiliado ganha sem a compra concluir | Toda movimentação é **transação ACID** numa função PL/pgSQL única, com locks de linha. |
| Saldo inconsistente | **Ledger de partidas dobradas** (cada grupo soma zero, validado por trigger). `reconcile_wallet()` audita. |
| Vazamento de dados entre usuários | **RLS** em todas as tabelas; PII isolada em tabela separada; funções financeiras em schema privado. |
| Vendedor/afiliado recebe antes da entrega | **Escrow**: saldo fica `pendente` até confirmação do comprador ou liberação automática (X dias). |
| Saque maior que o saldo | Débito atômico com `FOR UPDATE` e checagem `saldo_disponivel >= valor`. |

---

## Pré-requisitos

- Node.js ≥ 18.18
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npx supabase`)
- Docker (para o Supabase local)
- Conta Mercado Pago (para produção) — em dev use `PAYMENT_PROVIDER=mock`

## Setup

```bash
# 1. Instale as dependências
npm install

# 2. Configure o ambiente
cp .env.example .env.local
#   - Em dev local, deixe PAYMENT_PROVIDER=mock

# 3. Suba o Supabase local (aplica as migrations de supabase/migrations)
npm run db:start
npm run db:reset      # aplica migrations + seed de demonstracao (supabase/seed.sql)

# 4. Pegue as chaves locais e cole no .env.local
npx supabase status   # copie API URL, anon key e service_role key

# 5. Rode o app
npm run dev
```

### Contas de demonstração (seed)

Após `npm run db:reset`, a loja já abre populada. Senha de todas: **`Senha12345`**.

| Conta | Papel | Tem |
|---|---|---|
| `vendedor@demo.com` | Vendedor | 3 anúncios ativos |
| `afiliado@demo.com` | Afiliado | links de afiliado prontos |
| `comprador@demo.com` | Comprador | — |
| `admin@demo.com` | Mediador (admin) | resolve disputas |

> Para testar o fluxo completo em dev: entre como **comprador**, abra um anúncio,
> clique **Comprar**, preencha o **endereço de entrega** e pague (o modo `mock`
> redireciona para uma rota que aprova o pagamento). Depois, como **vendedor**,
> veja o endereço no pedido e marque como enviado; volte como comprador e
> confirme o recebimento para liberar os fundos.

> **Produção / Supabase Cloud:** em *Project Settings → API → Exposed schemas*,
> adicione **`app`** (necessário para o backend chamar as funções financeiras via
> RPC). O acesso segue protegido: `anon`/`authenticated` não têm `USAGE` no schema.

## Verificação

```bash
npm run typecheck                 # tipos
npm test                          # testes unitários (split/dinheiro)
# Teste do fluxo financeiro ponta-a-ponta (escrow + idempotência + ledger):
npx supabase db reset
psql "$(npx supabase status -o env | grep DB_URL | cut -d= -f2-)" -f supabase/tests/escrow_flow.test.sql
```

---

## Endpoints da API

### Autenticação (`/api/auth`)
| Método | Rota | Descrição |
|---|---|---|
| POST | `/register` | Cria conta (Supabase Auth + profile + carteira via trigger) |
| POST | `/login` | Login (sessão em cookies HTTP-only, access token 15 min) |
| POST | `/logout` | Encerra sessão |

### Produtos (`/api/products`)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/` | Lista anúncios ativos (com simulação de split) |
| POST | `/` | Cria anúncio (vendedor) |
| GET | `/:id` | Detalhe |
| PATCH | `/:id` | Edita (dono) |
| DELETE | `/:id` | Exclusão lógica (dono) |

### Afiliação
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/affiliate/links` | Gera/reaproveita link de afiliado |
| GET | `/api/affiliate/links` | Lista links do afiliado |
| GET | `/api/r/:code` | Registra clique, grava cookie de atribuição, redireciona |

### Checkout & Pedidos
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/checkout` | Cria pedido + cobrança no gateway |
| POST | `/api/webhooks/mercadopago` | Webhook (assinado, idempotente) |
| GET | `/api/orders?role=` | Lista pedidos por papel |
| POST | `/api/orders/:id/ship` | Vendedor informa envio |
| POST | `/api/orders/:id/confirm-delivery` | Comprador confirma → libera fundos |
| POST | `/api/orders/:id/dispute` | Comprador abre disputa |
| POST | `/api/admin/orders/:id/resolve` | Mediação (admin) resolve disputa |

### Carteira
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/wallet` | Saldos + extrato (ledger) |
| POST | `/api/wallet/withdraw` | Solicita saque do saldo disponível |

---

## Fluxo financeiro (resumo)

```
checkout ──► create_order (snapshot do split, funds_state=aguardando_pagamento)
                │
        gateway │ (comprador paga; plataforma é a recebedora — Escrow)
                ▼
webhook ──► confirm_payment ──► saldo_PENDENTE (vendedor + afiliado)  [funds_state=retido]
                │
   vendedor envia (mark_shipped → inicia contagem de X dias)
                │
   comprador confirma (confirm_delivery)   OU   auto_release (cron, após X dias)
                ▼
            release_funds ──► saldo_DISPONÍVEL  [funds_state=liberado, status=concluido]
                                     │
                            withdraw ─┴─► payout PIX (saldo debitado atomicamente)
```

Disputa congela tudo em `pendente` até a mediação (`resolve_dispute`: liberar ou
estornar).

---

## Pendências para produção (claramente marcadas no código)

- **Disbursement PIX real** dos saques e estornos no gateway (o efeito contábil já
  é aplicado; falta acionar a API de payout/refund do Mercado Pago).
- **Criptografia em nível de coluna** da PII sensível (documento, dados bancários)
  via Supabase Vault.
- **KYC / verificação de conta** antes de habilitar saques.
- **UI / frontend** completo.
