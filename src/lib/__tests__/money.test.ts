import { describe, it, expect } from "vitest";
import { toCents, percentToBps, computeSplit, formatBRL } from "@/lib/money";

describe("money utils", () => {
  it("converte reais para centavos sem erro de float", () => {
    expect(toCents(123.45)).toBe(12345);
    expect(toCents("0,99")).toBe(99);
    expect(toCents(0.1 + 0.2)).toBe(30); // classico 0.30000000004
  });

  it("converte percentual para basis points", () => {
    expect(percentToBps(15)).toBe(1500);
    expect(percentToBps("15,5")).toBe(1550);
  });

  it("formata BRL", () => {
    expect(formatBRL(12345)).toMatch(/123,45/);
  });
});

describe("computeSplit (espelha a logica do banco)", () => {
  it("split com afiliado fecha exatamente com o total", () => {
    const total = 10000; // R$ 100,00
    const s = computeSplit({
      totalCents: total,
      commissionBps: 1500, // 15%
      platformFeeBps: 500, // 5%
      hasAffiliate: true,
    });
    expect(s.commissionCents).toBe(1500);
    expect(s.platformFeeCents).toBe(500);
    expect(s.sellerNetCents).toBe(8000);
    expect(s.commissionCents + s.platformFeeCents + s.sellerNetCents).toBe(total);
  });

  it("venda direta (sem afiliado): comissao zero, vendedor fica com a fatia", () => {
    const total = 10000;
    const s = computeSplit({
      totalCents: total,
      commissionBps: 1500,
      platformFeeBps: 500,
      hasAffiliate: false,
    });
    expect(s.commissionCents).toBe(0);
    expect(s.platformFeeCents).toBe(500);
    expect(s.sellerNetCents).toBe(9500);
    expect(s.commissionCents + s.platformFeeCents + s.sellerNetCents).toBe(total);
  });

  it("valores com centavos quebrados continuam fechando (floor por beneficiario)", () => {
    const total = 9999; // R$ 99,99
    const s = computeSplit({
      totalCents: total,
      commissionBps: 1333,
      platformFeeBps: 500,
      hasAffiliate: true,
    });
    // O resto de arredondamento sobra para o vendedor; a soma sempre fecha.
    expect(s.commissionCents + s.platformFeeCents + s.sellerNetCents).toBe(total);
    expect(s.sellerNetCents).toBeGreaterThanOrEqual(0);
  });
});
