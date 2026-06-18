# PENDENTE — Faixa de preço + comissão de afiliado variável

> Funcionalidade **implementada no código** (faixa mín/desejado, afiliado escolhe o
> preço, comissão cresce com o preço — modelos **linear** e **tiers**).
> Falta **aplicar a migration no banco**. O Docker Desktop estava com falha de
> engine (erro 500), por isso o SQL ainda não rodou.

## Como retomar (depois de reiniciar o PC)

1. **Abrir o Docker Desktop** e esperar ficar "Engine running" (ícone verde).

2. **Subir o Supabase local** (na pasta do projeto):
   ```
   npx supabase start
   ```
   (se já estiver de pé, pule)

3. **Aplicar a migration nova** recriando o banco local com seed:
   ```
   npm run db:reset
   ```
   Isso roda todas as migrations, incluindo a nova:
   `supabase/migrations/20260618130000_price_range_commission.sql`

4. **Rodar o teste de escrow** (garante que o split/escrow continua certo):
   ```
   npx supabase test db
   ```
   (arquivo: `supabase/tests/escrow_flow.test.sql`)

5. **Subir o app e testar na prática**:
   ```
   npm run dev
   ```
   - Em **/vender**: definir preço desejado (ex.: 2100) e mínimo (ex.: 1800),
     escolher comissão **linear** (5%→15%) ou **por faixas**; conferir a simulação.
   - Na **página do produto**: ver a faixa e a comissão crescente.
   - Como afiliado: clicar em **"Promover e escolher meu preço"**, escolher um valor
     na faixa e ver a prévia da comissão; gerar o link `?ref=`.
   - Abrir o link `?ref=` como outro usuário e conferir que o preço/comissão batem.

## Verificações já feitas (não precisa repetir)
- `npm run typecheck` → limpo
- `npm run test` → 10/10 (inclui casos linear/tiers com 1800/2100)
- `npm run build` → OK

## Como publicar no Supabase remoto (quando for pra produção)
```
npm run db:push
```

## Decisões em aberto (confirmar com calma)
1. Cards de listagem/loja mostram o **preço desejado**, não a faixa
   ("a partir de R$ X"). Quer mudar?
2. Link de afiliado inválido (`?ref=` inexistente) cai no **preço-alvo**.

## Arquivos alterados nesta entrega
- `supabase/migrations/20260618130000_price_range_commission.sql` (novo)
- `src/lib/money.ts`, `src/lib/validation.ts`, `src/lib/products.ts` (novo)
- `src/components/PricingFields.tsx` (novo), `SellForm.tsx`, `EditProductForm.tsx`,
  `ProductActions.tsx`
- `src/app/produto/[id]/page.tsx`, `src/app/produto/[id]/editar/page.tsx`
- `src/app/api/products/route.ts`, `src/app/api/products/[id]/route.ts`,
  `src/app/api/affiliate/links/route.ts`
- `src/lib/__tests__/money.test.ts`
