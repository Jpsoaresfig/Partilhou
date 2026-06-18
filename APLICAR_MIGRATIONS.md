# Como aplicar as migrations (notificações) — passo a passo

> Contexto: a feature de **Notificações** já está toda no código. Falta só
> aplicar a migration no banco local. O Docker Desktop estava com o engine
> travado (erro 500), por isso o computador será reiniciado.

## Situação atual

- **Alvo:** Supabase **local** (`http://127.0.0.1:54321`), roda em Docker.
- **Migration nova:** `supabase/migrations/20260618130000_notifications.sql`
  (tabela `notifications` + RLS + grants + triggers que geram as notificações).
- **Bloqueio:** o engine do Docker Desktop estava retornando `500 Internal
  Server Error` (backend Linux/WSL não saudável). O stack local não sobe sem ele.

## Depois de reiniciar o PC

### 1. Suba o Docker Desktop e confirme que o engine está saudável
Abra o **Docker Desktop** e espere o ícone ficar verde ("Engine running").
Confirme no terminal:
```bash
docker info
```
Se imprimir as infos sem erro 500, está pronto. Se ainda der erro:
Docker Desktop → ⚙ Settings → **Troubleshoot** → **Restart** (ou **Reset to
factory defaults** em último caso).

### 2. Suba o stack local do Supabase
No diretório do projeto (`C:\Users\jpbus\Desktop\Partilhou`):
```bash
npx supabase start
```

### 3. Aplique as migrations
Há duas opções:

**a) Aplicar só as migrations novas (mantém os dados existentes):**
```bash
npx supabase migration up
```

**b) Resetar o banco (recria do zero + roda seed.sql) — apaga os dados locais:**
```bash
npm run db:reset
```
> Use a opção (b) se quiser um banco limpo com o seed. Use (a) para preservar
> o que já existe.

### 4. Verifique se a tabela foi criada
```bash
npx supabase migration list
```
A migration `20260618130000_notifications` deve aparecer como aplicada.

### 5. Rode a aplicação e teste
```bash
npm run dev
```
- Acesse `/notificacoes` (precisa estar logado).
- O link **Notificações** aparece na navbar, com badge vermelho de não lidas.
- As notificações são geradas automaticamente nas transições de pedido/saque
  (pagamento confirmado, envio, liberação, disputa, estorno, saque).

---

## O que foi implementado (resumo)

| Arquivo | O quê |
|---|---|
| `supabase/migrations/20260618130000_notifications.sql` | Tabela `notifications`, RLS (lê/marca só as próprias), grants, e **triggers** em `orders` e `withdrawals` que criam as notificações |
| `src/app/notificacoes/page.tsx` | Página da aba — lista, destaque de não lidas, tempo relativo, link |
| `src/components/MarkAllReadButton.tsx` | Botão "Marcar todas como lidas" |
| `src/app/api/notifications/read/route.ts` | `POST` que marca como lida (uma ou todas) |
| `src/components/Navbar.tsx` | Link "Notificações" + badge de não lidas |
| `src/app/layout.tsx` | Busca a contagem de não lidas e passa pra navbar |
| `src/app/globals.css` | Estilos da lista/badge |

## Observação (não relacionada às notificações)
`npm run typecheck` acusa 1 erro pré-existente em `src/lib/money.ts:71`
(lógica de comissão/tiers que já estava modificada antes desta tarefa). Não tem
relação com as notificações e pode ser tratado à parte.
