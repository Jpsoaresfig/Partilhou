/**
 * Schemas de validacao de entrada (Zod). Toda rota valida o input antes de
 * tocar o banco. Mensagens em pt-BR.
 */
import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("E-mail invalido"),
  password: z.string().min(8, "Senha deve ter ao menos 8 caracteres").max(72),
  full_name: z.string().trim().min(2).max(160),
  document_number: z.string().trim().min(11).max(18).optional(),
  phone: z.string().trim().max(20).optional(),
});

export const loginSchema = z.object({
  email: z.string().email("E-mail invalido"),
  password: z.string().min(1, "Senha obrigatoria"),
});

export const createProductSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().max(8000).default(""),
  images: z.array(z.string().url()).max(12).default([]),
  // Valor em reais; convertido para centavos na rota.
  amount_total: z.number().positive().or(z.string()),
  // Percentual de comissao (0 a 100).
  commission_percent: z.number().min(0).max(100).or(z.string()),
});

export const updateProductSchema = z.object({
  title: z.string().trim().min(3).max(160).optional(),
  description: z.string().max(8000).optional(),
  images: z.array(z.string().url()).max(12).optional(),
  amount_total: z.number().positive().or(z.string()).optional(),
  commission_percent: z.number().min(0).max(100).or(z.string()).optional(),
  status: z.enum(["ativo", "pausado", "vendido", "excluido"]).optional(),
});

export const createAffiliateLinkSchema = z.object({
  product_id: z.string().uuid(),
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
