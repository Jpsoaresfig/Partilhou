# Partilhou — Estado e plano (handoff)

> Notas para retomar depois de reiniciar o PC. Última atualização: 2026-06-18.

---

## 🔑 Acessos importantes

- **Supabase Cloud**
  - Project ref: `cpxccqztduvgsdpriqyz`
  - URL: `https://cpxccqztduvgsdpriqyz.supabase.co`
  - Região: `us-east-2`
  - Ligação direta (IPv6, funciona nesta máquina) para aplicar SQL via psql:
    ```
    postgresql://postgres:<SENHA_DA_BD>@db.cpxccqztduvgsdpriqyz.supabase.co:5432/postgres?sslmode=require
    ```
- **Conta admin (já criada no cloud)**
  - Email: `admin@partilhou.app`
  - Senha: `123mudar`  ← senha fraca, trocar depois
  - `is_admin=true` no `app_metadata`
- **GitHub:** `Jpsoaresfig/Partilhou`, branch `main`

> 🔒 **Segurança:** o access token (`sbp_...`) e a senha da BD foram colados no chat.
> Quando der, **revogar o token** (Account → Tokens) e **rodar a senha** em
> Settings → Database. A app não precisa deles (usa as keys de API).

---

## ✅ O que já está FEITO

1. **DB Cloud provisionada** — as 13 migrations originais (`20260617*`) foram
   aplicadas via psql. Schema `app` exposto na Data API, `pg_cron` ativo + job de
   liberação automática, bucket `product-images`, RLS em todas as tabelas.
2. **Mobile responsivo** — commitado e enviado (`main`, commit `d1e3304`):
   viewport, menu hambúrguer, grids de 2 colunas viram 1, tabelas com scroll,
   inputs 16px (anti-zoom iOS).
3. **Conta admin** criada no **cloud** (ver acima). Falta criar no **local**.
4. **Migrations novas escritas** (ainda NÃO aplicadas — ver pendências):
   - `20260618120100_profile_and_region.sql` — perfil (cidade, UF, ano nascimento)
     + `products.region_uf` + recria a view `products_with_split`.
   - `20260618120200_ratings.sql` — reputação (tabela `ratings`, view
     `profile_reputation`, RPC `app.rate_order`).
   - `20260618120300_chat.sql` — chat afiliado↔vendedor (`conversations`,
     `messages`, RPC `app.start_conversation`, RLS).
5. **UI/API já feitas por mim:**
   - `src/lib/regions.ts` — lista de UFs.
   - Perfil ampliado (`ProfileForm.tsx` + `perfil/page.tsx`): email, CPF, celular,
     cidade/UF, ano de nascimento.
   - API `POST /api/orders/[id]/rate` — avaliar vendedor/afiliado.

---

## ⚠️ PROBLEMAS A RESOLVER ANTES DE APLICAR MIGRATIONS

1. **Timestamp duplicado:** existem DUAS migrations com `20260618130000`
   (`_notifications.sql` e `_price_range_commission.sql`). A versão da migration
   é o prefixo de 14 dígitos → colisão. **Renomear uma** (ex.: price_range →
   `20260618130100_price_range_commission.sql`).
2. **Trabalho concorrente em curso** (outro agente/processo) — construiu/alterou
   em paralelo: categorias + atributos, notificações, filtros de preço, avatar/loja.
   Ficheiros tocados por esse esforço (NÃO sobrescrever sem ler antes):
   `categories.ts`, `AttributeFields.tsx`, `SellForm.tsx`, `EditProductForm.tsx`,
   `validation.ts`, `money.ts`, `globals.css`, `layout.tsx`, `Navbar.tsx`,
   `ProductActions.tsx`, `products.ts`, `/api/products`, `/api/notifications`,
   `/notificacoes`, migrations `product_attributes`, `notifications`,
   `price_range_commission`.

---

## 📋 PLANO ao voltar (ordem sugerida)

1. **Resolver o timestamp duplicado** (renomear a migration).
2. **Aplicar TODAS as migrations novas:**
   - Local: `npm run db:start` → `npm run db:reset` (aplica tudo + seed).
   - Cloud: aplicar via psql as migrations `20260618*` em ordem (ligação acima),
     ou tentar `supabase db push` (na altura a CLI falhava a obter API keys —
     se persistir, usar psql como antes) e registar no histórico.
3. **Criar admin no LOCAL** (mesmo SQL usado no cloud, com `extensions.crypt`).
4. **Reputação (UI):** mostrar confiabilidade do vendedor e do afiliado na página
   de produto e na "loja"; `RatingForm` no pedido concluído (a API
   `/api/orders/[id]/rate` já existe).
5. **Chat (UI):** páginas `/chat` (lista) e `/chat/[id]` (thread); botão "Conversar
   com o vendedor" (em `ProductActions`, que é meu); API `POST /api/chat/start`
   (chama `app.start_conversation`); envio de mensagens via client (RLS já permite).
6. **Busca + filtros na home:** barra de pesquisa + filtros por categoria, região
   (UF) e preço. ⚠️ Coordenar com `src/lib/products.ts` do outro esforço (pode já
   ter a query de filtros).
7. **Painel admin** (`/admin`): expandir para gerir produtos, usuários, categorias
   e disputas (hoje só faz disputas).
8. **Verificar:** `npm run typecheck` + `npm run build` + smoke test + `commit/push`.

---

## 🧭 Decisões já tomadas (do utilizador)

- Aplicar no **Cloud + repo + Local**.
- Admin: `admin@partilhou.app` / `123mudar`.
- Categorias: pedi "padrão BR", mas o outro esforço já implementou um conjunto
  próprio em `categories.ts` (carros, celulares, informática, eletrónicos,
  imóveis, móveis, moda, outros) — **seguir o que está em `categories.ts`**.
- Região = **UF (estados)**, ligada ao "de onde é" do perfil.

## 🗒️ Funcionalidades pedidas (checklist global)

- [x] Conta admin (cloud) · [ ] admin (local)
- [~] Filtro por região (schema feito; falta UI na home)
- [~] Filtro por tipo de produto (categorias feitas pelo outro esforço; falta filtro na home)
- [ ] Aba/barra de pesquisa
- [x] Meus anúncios (à venda) — já existe no painel
- [x] Meus produtos afiliados — já existe no painel (aba Afiliações)
- [~] Chat afiliado↔vendedor (schema feito; falta UI)
- [x] Exibir valor/fotos/descrição do produto — já existe
- [~] Confiabilidade/avaliação de vendedor e afiliado (schema+API feitos; falta UI)
- [x] Perfil: de onde é, email, celular, CPF, ano de nascimento

> Legenda: [x] feito · [~] parcial · [ ] por fazer
