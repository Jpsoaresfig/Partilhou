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
