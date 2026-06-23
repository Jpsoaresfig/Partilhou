# Partilhou — Documento de Apresentação para Investidor

> Versão 1.0 — Junho/2026
> Documento de visão de negócio + produto + tecnologia.
> Público-alvo: investidor avaliando aporte / sócio estratégico.

---

## 1. Resumo executivo (o "elevator pitch")

**A Partilhou é um marketplace C2C (pessoa-para-pessoa) de produtos usados com um programa de afiliados embutido, pagamento garantido por escrow e divisão automática de valores entre vendedor, afiliado e plataforma.**

A diferença em relação a um classificado tradicional (estilo OLX) é simples e poderosa:

> Na OLX, você anuncia e torce para alguém achar. Na Partilhou, **qualquer pessoa pode virar "afiliado" e divulgar o produto de outro vendedor ganhando uma comissão por venda** — e o dinheiro de todo mundo fica retido com segurança até a entrega ser confirmada.

Em uma frase: **transformamos cada usuário em um vendedor da sua rede.** O vendedor define a comissão, o afiliado divulga onde quiser (WhatsApp, Instagram, grupos), e a plataforma garante que todos recebam — vendedor, afiliado e Partilhou — de forma automática e segura.

**Mercado:** Brasil (UI em português, R$/BRL, PIX, CPF/CNPJ, gateway Mercado Pago).

---

## 2. O problema que resolvemos

O mercado de usados no Brasil é gigante, mas sofre de três dores crônicas:

| Dor | Hoje (OLX, Facebook Marketplace, grupos de WhatsApp) | Partilhou |
|---|---|---|
| **Medo do golpe** | Pagamento direto entre estranhos. Calote dos dois lados. | Escrow: dinheiro fica retido até a entrega ser confirmada. |
| **Alcance limitado** | O anúncio só vende se a pessoa certa achar. | Exército de afiliados divulga por comissão. |
| **Sem incentivo para indicar** | Você indica um produto e não ganha nada. | Afiliado ganha comissão real por venda. |

A Partilhou junta o **modelo de afiliados** (que move bilhões no e-commerce de produtos *novos*, ex: Hotmart, Amazon Afiliados) com o **mercado de usados** — algo que praticamente não existe combinado no Brasil.

---

## 3. Intenção da aplicação (a visão)

Construir a **infraestrutura de confiança e distribuição** para o mercado informal brasileiro.

Hoje milhões de reais trocam de mãos em grupos de WhatsApp e Facebook sem nenhuma garantia, sem rastreio e sem que quem "divulgou" ganhe nada. A Partilhou quer ser a camada que:

1. **Garante o pagamento** (escrow) — acaba com o medo do golpe.
2. **Recompensa quem divulga** (afiliados) — transforma divulgação boca-a-boca em renda.
3. **Cria comunidades de venda** (Grupos) — organiza o caos dos grupos de WhatsApp dentro da plataforma, onde a transação acontece com segurança.

A visão de longo prazo é deixar de ser "um site de usados" e virar **o sistema operacional do comércio social brasileiro** — onde qualquer pessoa pode vender, qualquer pessoa pode revender por comissão, e toda transação é protegida.

---

## 4. Como funciona (o fluxo na prática)

### 4.1 Papéis dos usuários

Não há cargos fixos — **a mesma pessoa pode ser tudo ao mesmo tempo**:

- **Comprador** — paga, confirma entrega, avalia, abre disputa se necessário.
- **Vendedor** — cria o anúncio, define faixa de preço e comissão, marca como enviado, recebe o valor líquido.
- **Afiliado** — divulga o produto de outra pessoa com um link rastreável, escolhe o preço de venda dentro da faixa e ganha comissão.
- **Admin (mediador)** — resolve disputas (libera para o vendedor ou estorna o comprador).

### 4.2 O ciclo de uma venda

```
1. Vendedor anuncia  →  define preço-alvo, preço mínimo e a comissão do afiliado
2. Afiliado divulga  →  gera um link com código de rastreio (?ref=XXXX)
3. Comprador compra  →  paga via Mercado Pago. Dinheiro NÃO vai para ninguém ainda.
4. ESCROW            →  Partilhou retém o valor (saldo "pendente")
5. Vendedor envia    →  inicia o prazo de liberação automática (7 dias)
6. Comprador confirma→  o valor é DIVIDIDO automaticamente:
                          • Vendedor recebe o líquido
                          • Afiliado recebe a comissão
                          • Partilhou recebe a taxa (5%)
7. Saque             →  cada um saca seu saldo disponível via PIX
8. Avaliação         →  comprador avalia vendedor e afiliado (reputação)
```

Se o comprador some, um robô (cron a cada 10 min) **libera automaticamente** o pagamento para o vendedor após o prazo — protegendo quem vendeu de boa-fé.

### 4.3 O grande diferencial: faixa de preço + comissão variável

Este é o recurso mais inovador do produto. Em vez de um preço fixo, o vendedor define uma **faixa**:

- **Preço-alvo** — o ideal, o teto (o que um comprador direto paga).
- **Preço mínimo** — o piso, o mínimo que aceita.

**O afiliado escolhe por quanto vai vender dentro dessa faixa. Quanto mais caro ele vende, maior a comissão dele.**

Isso cria um **alinhamento de incentivos perfeito**: o afiliado quer vender pelo maior preço possível (ganha mais comissão), o que também faz o vendedor receber mais e a plataforma faturar mais. Todos remam para o mesmo lado.

Dois modelos de comissão configuráveis pelo vendedor:
- **Linear** — a comissão sobe proporcionalmente entre o piso e o teto.
- **Faixas (tiers)** — degraus fixos definidos pelo vendedor (ex: vendeu até R$100 = 10%, até R$150 = 15%...).

---

## 5. Como a empresa lucra (modelo de receita)

### 5.1 Receita principal: taxa de transação (take rate)

A Partilhou cobra uma **taxa de 5% sobre cada venda concluída** (parâmetro `platform_fee_bps = 500`, configurável sem precisar reprogramar nada).

> Exemplo: numa venda de **R$ 200** com comissão de afiliado de 15%:
> - Plataforma (5%): **R$ 10,00**
> - Afiliado (15%): R$ 30,00
> - Vendedor (líquido): R$ 160,00

**A receita escala automaticamente com o volume de transações (GMV).** Não dependemos de assinatura nem de anúncios — ganhamos quando o usuário ganha. Esse é o modelo dos grandes marketplaces (Mercado Livre, Etsy, Airbnb).

### 5.2 Projeção simplificada

| GMV mensal (volume vendido) | Receita Partilhou (5%) | Receita anual |
|---|---|---|
| R$ 100 mil | R$ 5 mil | R$ 60 mil |
| R$ 1 milhão | R$ 50 mil | R$ 600 mil |
| R$ 10 milhões | R$ 500 mil | R$ 6 milhões |
| R$ 50 milhões | R$ 2,5 milhões | R$ 30 milhões |

> O número-chave a acompanhar é o **GMV (Gross Merchandise Value)** — o total transacionado. Nossa receita é uma fração fixa dele.

### 5.3 Fontes de receita futuras (já viáveis na arquitetura atual)

A taxa de 5% é só o começo. A mesma infraestrutura permite, sem grande esforço:

1. **Taxa de saque** — pequena tarifa por saque PIX (ou saque grátis acima de X).
2. **Anúncios em destaque** — vendedor paga para aparecer no topo da vitrine.
3. **Take rate dinâmico** — taxa menor para categorias de alto volume, maior para nicho.
4. **Grupos premium / assinatura** — comunidades pagas, ferramentas de gestão para "super afiliados".
5. **Float financeiro** — o dinheiro em escrow (saldo retido) é capital parado que, em escala, pode render (com a devida regulação).
6. **Boost de comissão patrocinado** — vendedor turbina a comissão para atrair afiliados, e a Partilhou intermedeia.

---

## 6. Como a empresa pode escalar

### 6.1 Por que escala bem (efeitos de rede)

A Partilhou tem **dois lados que se reforçam** (network effect clássico de marketplace), mais um terceiro que é o nosso diferencial:

```
   Mais vendedores  →  mais produtos  →  mais oportunidade para afiliados
        ↑                                          ↓
   Mais vendas  ←  mais alcance  ←  mais afiliados divulgando
```

O **afiliado é o motor de crescimento viral**: cada afiliado traz a *própria audiência* (seguidores, grupos, contatos) sem custo de marketing para nós. É um exército de vendedores que se paga sozinho — só ganham se venderem.

### 6.2 Escalabilidade técnica (já resolvida na fundação)

A arquitetura foi construída para escalar sem reescrita:

- **Custo de infraestrutura quase zero no início** — roda em Next.js (Vercel) + Supabase (Postgres gerenciado). Escala vertical e horizontalmente sob demanda, paga-se pelo uso.
- **Toda a lógica de dinheiro está no banco de dados** (funções `SECURITY DEFINER`), com **livro-razão de partidas dobradas (double-entry ledger)** e invariante de soma-zero — o padrão de bancos e fintechs. Isso significa que o sistema financeiro é auditável e à prova de inconsistência mesmo sob altíssima concorrência.
- **Webhooks idempotentes** — uma comissão é creditada exatamente uma vez, mesmo que o Mercado Pago notifique a mesma venda 10 vezes. Crítico para confiança financeira em escala.
- **Configuração sem deploy** — taxas, prazos e limites ficam numa tabela de configuração. Ajustar o take rate ou o prazo de escrow é uma mudança de uma linha, sem reprogramar.

### 6.3 Roteiro de crescimento (go-to-market)

**Fase 1 — Nicho e densidade (0 a 12 meses):**
Escolher 1 categoria + 1 região (ex: eletrônicos usados em uma capital). Recrutar 50-100 "super afiliados" (revendedores que já atuam em grupos de WhatsApp). Densidade > amplitude.

**Fase 2 — Comunidades / Grupos (já em desenvolvimento):**
A feature de **Grupos** organiza os vendedores e afiliados em comunidades temáticas/regionais dentro da plataforma — capturando para dentro do sistema o comércio que hoje vaza para o WhatsApp. Cada grupo vira um canal de aquisição.

**Fase 3 — Expansão de categorias e regiões:**
Replicar o playbook validado para novas verticais (moda, automotivo, casa) e novas cidades.

**Fase 4 — Monetização ampliada:**
Ativar as fontes de receita secundárias (destaques, assinatura de super afiliados, etc.).

---

## 7. Possíveis problemas de regras de negócio (riscos e mitigações)

> Esta seção é deliberadamente honesta. Um bom investidor valoriza saber que o time conhece os riscos.

### 7.1 Riscos regulatórios e financeiros

| Risco | Descrição | Mitigação |
|---|---|---|
| **Regulação de pagamentos** | Reter dinheiro de terceiros (escrow) e fazer split pode caracterizar atividade de instituição de pagamento, regulada pelo Banco Central. | Operar sobre o Mercado Pago (que já é regulado) como gateway; estruturar como "facilitador". Buscar parecer jurídico antes de escalar o float. **Item de due diligence prioritário.** |
| **Tributação do afiliado** | Comissão paga a pessoa física pode gerar obrigação fiscal (IR, emissão de nota). | Emitir informes de rendimento; futuramente reter/recolher na fonte. Limites de saque sem verificação. |
| **Lavagem de dinheiro / KYC** | Marketplace com saque PIX é vetor para fraude e lavagem. | Já existe estrutura de `account_status` (pendente_verificação / ativa / suspensa) e isolamento de PII. Falta plugar KYC real (verificação de documento) antes de liberar saques altos. |
| **Float e fluxo de caixa** | O dinheiro retido não é da empresa — é dos usuários. Confundir isso é fatal. | O ledger de partidas dobradas já separa contas. Nunca usar saldo de usuário como capital operacional sem licença. |

### 7.2 Riscos do modelo de marketplace

| Risco | Descrição | Mitigação |
|---|---|---|
| **Desintermediação ("vazamento")** | Comprador e vendedor se conhecem pelo chat e fecham por fora para fugir da taxa. | O valor do escrow (segurança) tem que ser maior que o custo da taxa. Penalizar/limitar troca de contato. Reputação só conta dentro da plataforma. |
| **Problema do ovo e da galinha** | Marketplace vazio não atrai ninguém (sem produtos não há afiliados, sem afiliados não há vendas). | A estratégia de **afiliados resolve isso**: eles trazem demanda antes de haver demanda orgânica. Começar denso num nicho. |
| **Qualidade / produto falso / não-entrega** | Produto usado pode não corresponder ao anúncio. | Escrow + disputa + reputação por papel (vendedor E afiliado avaliados). Futuramente: upload de evidências na disputa, anti-fraude. |
| **Afiliado promovendo lixo** | Afiliado pode divulgar produto ruim só pela comissão e queimar a confiança. | Reputação do afiliado é avaliada separadamente — afiliado com má reputação perde alcance. |

### 7.3 Riscos específicos da regra de comissão variável

| Risco | Descrição | Mitigação |
|---|---|---|
| **Guerra de preço entre afiliados** | Vários afiliados do mesmo produto podem competir baixando o preço (e a comissão) até o piso, prejudicando o vendedor. | Como a comissão *cai* junto com o preço, o próprio afiliado é desincentivado a vender barato. O piso (`min_price_cents`) protege o vendedor. |
| **Complexidade para o usuário** | Faixa de preço + comissão linear/tiers pode confundir vendedores leigos. | A UI já mostra simulação em tempo real (espelhada do banco). Oferecer presets ("comissão simples 10%") para quem não quer configurar. |
| **Atribuição de comissão (last-click)** | Se dois afiliados divulgam, quem ganha? Hoje é "último clique" (cookie de 30 dias). | Regra clara e padrão de mercado. Documentar para evitar disputa entre afiliados. |

### 7.4 Riscos operacionais

- **Disputas em escala** — mediação manual não escala. Precisará de regras automáticas, SLA e, futuramente, IA de triagem. (Hoje é 100% manual no `/admin`.)
- **Suporte e chargeback** — estorno no cartão (Mercado Pago) pode acontecer *depois* da liberação do escrow. Precisa de reserva de risco.
- **Dependência do Mercado Pago** — fornecedor único de pagamento. Mitigar com a `PaymentProvider` (interface já abstraída — trocar/adicionar gateway é plugável).

---

## 8. Como rodar a aplicação (operacional e técnico)

### 8.1 Stack tecnológica

| Camada | Tecnologia |
|---|---|
| Frontend + Backend | **Next.js 15** (App Router), React 18, TypeScript |
| Banco de dados + Auth | **Supabase** (Postgres gerenciado + autenticação + RLS) |
| Pagamentos | **Mercado Pago** Checkout Pro (com interface plugável para outros) |
| Validação | Zod |
| Testes | Vitest |
| Agendamento | pg_cron (liberação automática de escrow) |
| Hospedagem | Vercel (app) + Supabase Cloud (banco) |

### 8.2 Pré-requisitos para rodar

1. **Node.js** instalado.
2. Conta **Supabase** (banco + auth).
3. Conta **Mercado Pago** (credenciais de teste para desenvolvimento — ou usar o provedor `mock` embutido).
4. Variáveis de ambiente configuradas (arquivo `.env`):
   - Públicas: URL do app, URL e chave anônima do Supabase, chave pública do Mercado Pago.
   - Secretas (servidor): chave service_role do Supabase, token do Mercado Pago, segredo do webhook, segredo de hash de afiliado.

### 8.3 Passos para subir em desenvolvimento

```bash
# 1. Instalar dependências
npm install

# 2. Configurar o banco (aplicar as migrations no Supabase)
npm run db:push

# 3. Rodar os testes (garante que a lógica financeira está íntegra)
npm test

# 4. Subir o app local
npm run dev
# Acessa em http://localhost:3000
```

> Em desenvolvimento, dá para usar `PAYMENT_PROVIDER=mock` para simular pagamentos sem precisar do Mercado Pago real.

### 8.4 Para colocar em produção

1. **Banco:** aplicar as migrations no projeto Supabase Cloud (`npm run db:push`).
2. **App:** deploy no Vercel conectando o repositório (build automático).
3. **Variáveis:** configurar as mesmas variáveis de ambiente no painel da Vercel, com as credenciais **reais** do Mercado Pago.
4. **Webhook:** apontar o webhook do Mercado Pago para `https://<seu-dominio>/api/webhooks/mercadopago`.
5. **Cron:** garantir que o `pg_cron` está ativo no Supabase para a liberação automática de escrow.
6. **Segurança:** rotacionar chaves/segredos antes de ir ao ar.

### 8.5 Estado atual do produto (transparência para o investidor)

- ✅ **Funcional e em ambiente local + Supabase Cloud:** vitrine, busca/filtros, anúncio, faixa de preço + comissão variável, checkout, escrow, split, carteira, saque, chat afiliado↔vendedor, reputação, notificações, painel de disputas.
- 🔶 **Em desenvolvimento:** feature de **Grupos** (comunidades) — UI e banco prontos localmente, deploy em Cloud pendente, falta a tela de feed de posts do grupo (`/grupos/[slug]`).
- 🔜 **Próximos passos técnicos (já mapeados na arquitetura):** KYC/verificação real de documento, desembolso PIX real automatizado, upload de evidências em disputas, módulo anti-fraude.

> **Resumo honesto:** o **núcleo transacional (o mais difícil e crítico) está construído e é robusto** — escrow, split, ledger de partidas dobradas, idempotência, segurança. O que falta é majoritariamente **crescimento, KYC e operação**, não fundação técnica.

---

## 9. Por que investir agora (a tese)

1. **Mercado enorme e mal servido** — usados no Brasil é informal, desconfiado e sem incentivo de distribuição.
2. **Diferencial defensável** — a combinação afiliados + escrow + comissão variável não existe pronta no mercado brasileiro.
3. **Crescimento viral embutido** — os afiliados são um canal de aquisição que se paga sozinho.
4. **Receita alinhada ao sucesso do usuário** — ganhamos quando eles ganham (take rate sobre GMV).
5. **Fundação técnica de fintech já pronta** — a parte mais cara e arriscada (o sistema financeiro) está construída com padrões de banco.
6. **Múltiplas alavancas de monetização** — 5% é só o começo; destaques, assinaturas, taxas de saque e float ampliam a margem.

**O capital do investidor entra principalmente para:** crescimento (recrutar super afiliados e densificar nichos), conformidade (jurídico/KYC/pagamentos) e operação (suporte e mediação) — e não para construir o produto do zero, que já existe.

---

### Apêndice — Glossário rápido para a conversa com o investidor

- **GMV** — volume total transacionado. Nossa receita é 5% disso.
- **Take rate** — a fração que a plataforma fica (5%).
- **Escrow** — dinheiro retido pela plataforma até a entrega ser confirmada.
- **Split** — divisão automática do valor entre vendedor, afiliado e plataforma.
- **C2C** — consumer-to-consumer (pessoa vende para pessoa).
- **Network effect** — quanto mais gente usa, mais valioso fica para todos.
- **Ledger / livro-razão** — registro contábil de toda movimentação de dinheiro, auditável.
- **Last-click** — regra de atribuição: o último afiliado clicado leva a comissão.
