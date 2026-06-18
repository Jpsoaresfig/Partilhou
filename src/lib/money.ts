/**
 * Utilitarios monetarios.
 *
 * Toda a aritmetica do sistema usa CENTAVOS (inteiros). Nunca usamos float para
 * dinheiro. Percentuais sao "basis points" (bps): 1500 = 15,00%.
 */

/** Converte reais (string ou number) em centavos inteiros, com seguranca. */
export function toCents(reais: number | string): number {
  const n = typeof reais === "string" ? Number(reais.replace(",", ".")) : reais;
  if (!Number.isFinite(n) || n < 0) {
    throw new Error("Valor monetario invalido");
  }
  // Arredonda para o centavo mais proximo evitando erro de ponto flutuante.
  return Math.round(n * 100);
}

/** Formata centavos como moeda BRL (ex.: 12345 -> "R$ 123,45"). */
export function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

/** Converte percentual (ex.: 15 ou 15.5) para basis points inteiros. */
export function percentToBps(percent: number | string): number {
  const n = typeof percent === "string" ? Number(percent.replace(",", ".")) : percent;
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new Error("Percentual invalido (0 a 100)");
  }
  return Math.round(n * 100);
}

export function bpsToPercent(bps: number): number {
  return bps / 100;
}

/** Limita bps ao intervalo valido [0, 10000]. */
function clampBps(bps: number): number {
  return Math.max(0, Math.min(10000, Math.round(bps)));
}

/** Um degrau de comissao: a partir de `min_price_cents`, paga `bps`. */
export type CommissionTier = { min_price_cents: number; bps: number };

export type CommissionModel = "linear" | "tiers";

/**
 * Resolve a comissao (bps) para um preco de venda. Espelha EXATAMENTE
 * app.resolve_commission_bps no banco (fonte da verdade), para a simulacao da
 * UI bater com o que sera congelado no pedido.
 *
 * - linear: interpola entre commissionMinBps (no piso) e commissionBps (no alvo).
 * - tiers : usa o degrau de maior preco que nao excede a venda (abaixo do
 *           primeiro degrau, usa o mais baixo).
 */
export function resolveCommissionBps(params: {
  saleCents: number;
  targetCents: number; // amount_total_cents (preco-alvo)
  floorCents: number | null; // min_price_cents (piso); null = sem faixa
  commissionBps: number; // comissao no alvo (maximo)
  commissionMinBps: number | null; // comissao no piso; null = constante
  model: CommissionModel;
  tiers?: CommissionTier[] | null;
}): number {
  const { saleCents, targetCents, commissionBps, model, tiers } = params;

  if (model === "tiers" && tiers && tiers.length > 0) {
    const sorted = [...tiers].sort((a, b) => a.min_price_cents - b.min_price_cents);
    let bps = sorted[0]!.bps; // fallback: degrau mais baixo
    for (const t of sorted) {
      if (t.min_price_cents <= saleCents) bps = t.bps;
    }
    return clampBps(bps);
  }

  const maxBps = commissionBps;
  const minBps = params.commissionMinBps ?? commissionBps;
  const floor = params.floorCents ?? targetCents;
  const target = targetCents;

  // Sem faixa (piso == alvo) ou degenerada: comissao constante (= alvo).
  if (target <= floor) return clampBps(maxBps);

  const price = Math.max(floor, Math.min(target, saleCents));
  return clampBps(minBps + ((price - floor) / (target - floor)) * (maxBps - minBps));
}

/**
 * Preco efetivo de venda de um afiliado: o escolhido (clampado a faixa) ou o
 * preco-alvo quando nao definido. Espelha app.affiliate_effective_price.
 */
export function affiliateEffectivePrice(
  saleCents: number | null,
  targetCents: number,
  floorCents: number | null,
): number {
  const floor = floorCents ?? targetCents;
  return Math.max(floor, Math.min(targetCents, saleCents ?? targetCents));
}

/**
 * Calcula o split em centavos. Espelha EXATAMENTE a logica do banco
 * (floor por beneficiario), para que a simulacao exibida ao usuario bata com
 * o que sera efetivado na transacao. Fonte da verdade continua sendo o banco.
 */
export function computeSplit(params: {
  totalCents: number;
  commissionBps: number;
  platformFeeBps: number;
  hasAffiliate: boolean;
}): {
  commissionCents: number;
  platformFeeCents: number;
  sellerNetCents: number;
} {
  const { totalCents, commissionBps, platformFeeBps, hasAffiliate } = params;
  const platformFeeCents = Math.floor((totalCents * platformFeeBps) / 10000);
  const commissionCents = hasAffiliate
    ? Math.floor((totalCents * commissionBps) / 10000)
    : 0;
  const sellerNetCents = totalCents - commissionCents - platformFeeCents;
  return { commissionCents, platformFeeCents, sellerNetCents };
}
