/**
 * Conversao do input de anuncio (reais/percentual) para as colunas de `products`
 * (centavos/bps). Compartilhado por POST e PATCH de /api/products.
 */
import { toCents, percentToBps, type CommissionTier } from "@/lib/money";

type ProductPricingInput = {
  amount_total?: number | string;
  min_price?: number | string;
  commission_percent?: number | string;
  commission_min_percent?: number | string;
  commission_model?: "linear" | "tiers";
  commission_tiers?: { price: number | string; percent: number | string }[];
};

/**
 * Mapeia apenas as chaves presentes (suporta PATCH parcial). Para o modelo
 * "tiers", normaliza os degraus em {min_price_cents, bps} ordenados por preco.
 */
export function productPricingColumns(body: ProductPricingInput): Record<string, unknown> {
  const cols: Record<string, unknown> = {};
  if (body.amount_total !== undefined) cols.amount_total_cents = toCents(body.amount_total);
  if (body.min_price !== undefined) cols.min_price_cents = toCents(body.min_price);
  if (body.commission_percent !== undefined)
    cols.commission_bps = percentToBps(body.commission_percent);
  if (body.commission_min_percent !== undefined)
    cols.commission_min_bps = percentToBps(body.commission_min_percent);
  if (body.commission_model !== undefined) cols.commission_model = body.commission_model;
  if (body.commission_tiers !== undefined) {
    cols.commission_tiers = body.commission_tiers
      .map((t): CommissionTier => ({
        min_price_cents: toCents(t.price),
        bps: percentToBps(t.percent),
      }))
      .sort((a, b) => a.min_price_cents - b.min_price_cents);
  }
  return cols;
}
