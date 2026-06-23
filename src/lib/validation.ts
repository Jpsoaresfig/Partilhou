/**
 * Schemas de validacao de entrada (Zod). Toda rota valida o input antes de
 * tocar o banco. Mensagens em pt-BR.
 */
import { z } from "zod";

// Campos opcionais de formulario chegam como "" (string vazia) quando em branco.
// Convertemos "" -> undefined para que o `.optional()` valha e nao dispare o
// `.min()`. Sem isso, deixar o CPF/telefone em branco quebraria o cadastro.
const optionalText = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    schema.optional(),
  );

// Checkbox de formulario: chega como "on"/"true"/true quando marcado, ausente
// quando desmarcado. Normalizamos para boolean e exigimos `true`.
const requiredCheckbox = (message: string) =>
  z.preprocess(
    (v) => v === true || v === "true" || v === "on" || v === "1",
    z.literal(true, { errorMap: () => ({ message }) }),
  );

export const registerSchema = z.object({
  email: z.string().trim().min(1, "Informe o e-mail").email("E-mail invalido"),
  password: z
    .string()
    .min(8, "A senha deve ter ao menos 8 caracteres")
    .max(72, "A senha deve ter no maximo 72 caracteres"),
  full_name: z
    .string()
    .trim()
    .min(2, "Informe seu nome completo")
    .max(160, "Nome muito longo"),
  document_number: optionalText(
    z.string().trim().min(11, "CPF/CNPJ invalido").max(18, "CPF/CNPJ invalido"),
  ),
  phone: optionalText(z.string().trim().max(20, "Telefone invalido")),
  // Aceite obrigatorio dos termos + privacidade.
  accept_terms: requiredCheckbox("Voce precisa aceitar os Termos e a Politica de Privacidade"),
  // Declaracao obrigatoria de maioridade (so 18+ podem vender).
  is_adult: requiredCheckbox("E preciso ter 18 anos ou mais para criar uma conta"),
});

// Formulario "Reportar problema" (/reportar). Funciona logado ou nao.
export const reportSchema = z.object({
  category: z
    .enum(["pagamento", "conta", "anuncio", "bug", "abuso", "outro"])
    .default("outro"),
  message: z
    .string()
    .trim()
    .min(10, "Descreva o problema com ao menos 10 caracteres")
    .max(4000, "Mensagem muito longa"),
  email: optionalText(z.string().trim().email("E-mail invalido")),
  url: optionalText(z.string().trim().max(300)),
});

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Informe o e-mail").email("E-mail invalido"),
  password: z.string().min(1, "Informe a senha"),
});

// Categoria (slug) e mapa flexivel de atributos do anuncio. Os valores sao
// strings (campos) ou array de strings (opcionais). A semantica de cada campo
// vive em src/lib/categories.ts; aqui validamos apenas forma e tamanho.
const categorySchema = z.string().trim().max(40);
const attributesSchema = z
  .record(z.string().max(60), z.union([z.string().max(200), z.array(z.string().max(80)).max(40)]))
  .refine((v) => JSON.stringify(v).length <= 8000, "Atributos muito grandes");

// Fotos RECOMENDADAS para selo "Verificado" (frente, verso, tela ligada,
// laterais, IMEI...). NAO e um minimo de criacao: a validacao classifica, nao
// bloqueia. Usado pelo calculo de trust_score (src/lib/trust.ts).
export const MIN_PRODUCT_IMAGES = 6;

// IMEI estruturado (celulares): 14 a 16 digitos (15 padrao; aceita IMEISV).
// Opcional no MVP; a verificacao de bloqueio/roubo e externa (manual no inicio).
const imeiSchema = optionalText(
  z.string().trim().regex(/^\d{14,16}$/, "IMEI deve ter de 14 a 16 digitos"),
);

// Valores monetarios em reais (string com virgula ou number); viram centavos na rota.
const moneyInput = z.number().positive().or(z.string());
// Percentual de comissao (0 a 100).
const percentInput = z.number().min(0).max(100).or(z.string());

// Um degrau de comissao para o modelo "tiers": a partir de `price` (reais),
// paga `percent`. Convertido para {min_price_cents, bps} na rota.
const commissionTierInput = z.object({
  price: moneyInput,
  percent: percentInput,
});

// Modelo de comissao do afiliado:
//  - linear: cresce de commission_min_percent (no piso) ate commission_percent (no alvo)
//  - tiers : degraus fixos definidos pelo vendedor
const commissionModelSchema = z.enum(["linear", "tiers"]);

// Garante coerencia faixa/comissao: piso <= alvo; tiers exige degraus.
const refineProduct = <T extends {
  amount_total?: unknown;
  min_price?: unknown;
  commission_model?: string;
  commission_tiers?: unknown[];
}>(schema: z.ZodType<T>) =>
  schema.superRefine((v, ctx) => {
    if (v.commission_model === "tiers" && (!v.commission_tiers || v.commission_tiers.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Defina ao menos um degrau de comissao para o modelo por faixas",
        path: ["commission_tiers"],
      });
    }
  });

export const createProductSchema = refineProduct(
  z.object({
    title: z.string().trim().min(3).max(160),
    description: z.string().max(8000).default(""),
    // Pelo menos 1 foto para o anuncio existir; 6+ sobem o trust_score (nao bloqueia).
    images: z.array(z.string().url()).min(1, "Envie ao menos 1 foto do produto").max(12),
    // IMEI (celulares). Opcional, mas estruturado para a verificacao.
    imei: imeiSchema,
    // Preco-alvo (teto / venda direta), em reais.
    amount_total: moneyInput,
    // Piso da faixa (menor valor aceito). Ausente => preco fixo (= alvo).
    min_price: moneyInput.optional(),
    // Comissao no preco-alvo (maximo).
    commission_percent: percentInput,
    // Comissao no piso (linear). Ausente => comissao constante.
    commission_min_percent: percentInput.optional(),
    commission_model: commissionModelSchema.default("linear"),
    commission_tiers: z.array(commissionTierInput).max(12).optional(),
    category: categorySchema.default("outros"),
    attributes: attributesSchema.default({}),
  }),
);

export const updateProductSchema = refineProduct(
  z.object({
    title: z.string().trim().min(3).max(160).optional(),
    description: z.string().max(8000).optional(),
    images: z.array(z.string().url()).min(1).max(12).optional(),
    imei: imeiSchema,
    amount_total: moneyInput.optional(),
    min_price: moneyInput.optional(),
    commission_percent: percentInput.optional(),
    commission_min_percent: percentInput.optional(),
    commission_model: commissionModelSchema.optional(),
    commission_tiers: z.array(commissionTierInput).max(12).optional(),
    status: z.enum(["ativo", "pausado", "vendido", "excluido"]).optional(),
    category: categorySchema.optional(),
    attributes: attributesSchema.optional(),
  }),
);

export const createAffiliateLinkSchema = z.object({
  product_id: z.string().uuid(),
  // Preco que o afiliado escolheu vender (reais), dentro da faixa do produto.
  sale_price: moneyInput.optional(),
});

// Endereco de entrega informado pelo comprador no checkout. E "fotografado" no
// pedido (snapshot) — o vendedor usa para despachar.
export const shippingAddressSchema = z.object({
  recipient: z.string().trim().min(2, "Informe o destinatario").max(160),
  // CEP no formato 00000-000 (8 digitos com hifen) ou 8 digitos.
  zip: z
    .string()
    .trim()
    .regex(/^\d{5}-?\d{3}$/, "CEP invalido")
    .transform((v) => (v.length === 8 ? `${v.slice(0, 5)}-${v.slice(5)}` : v)),
  street: z.string().trim().min(2, "Informe a rua").max(200),
  number: z.string().trim().min(1, "Informe o numero").max(20),
  complement: z.string().trim().max(120).optional().default(""),
  district: z.string().trim().max(120).optional().default(""),
  city: z.string().trim().min(2, "Informe a cidade").max(120),
  state: z
    .string()
    .trim()
    .length(2, "UF deve ter 2 letras")
    .transform((v) => v.toUpperCase()),
});

export const checkoutSchema = z.object({
  product_id: z.string().uuid(),
  // Codigo de afiliado opcional (vindo do cookie de atribuicao ou do body).
  affiliate_code: z.string().trim().max(64).optional(),
  payer_email: z.string().email().optional(),
  shipping: shippingAddressSchema,
});

export const shipSchema = z.object({
  tracking_code: z.string().trim().max(120).optional(),
});

export const disputeSchema = z.object({
  reason: z.string().trim().min(5).max(2000),
});

export const resolveDisputeSchema = z.object({
  outcome: z.enum(["liberar", "estornar"]),
});

export const withdrawSchema = z.object({
  amount: z.number().positive().or(z.string()),
  pix_key: z.string().trim().min(3).max(140),
});

// --- Grupos (comunidades de vendas e promocoes) ------------------------------
// Forma e tamanho dos campos; a semantica de tema/icone vive em src/lib/groups.ts.
export const createGroupSchema = z.object({
  name: z.string().trim().min(3, "Nome muito curto").max(80, "Nome muito longo"),
  description: optionalText(z.string().trim().max(500, "Descricao muito longa")),
  theme: z
    .enum(["geral", "promocoes", "eletronicos", "moda", "casa", "automotivo", "regionais"])
    .default("geral"),
  visibility: z.enum(["publico", "privado"]).default("publico"),
  // Emoji/icone curto. Vazio => a vitrine usa o icone do tema.
  icon: optionalText(z.string().trim().max(8)),
  // UF (2 letras) para grupos regionais. Validada tambem por CHECK no banco.
  region_uf: optionalText(
    z.string().trim().length(2, "UF deve ter 2 letras").transform((v) => v.toUpperCase()),
  ),
});
