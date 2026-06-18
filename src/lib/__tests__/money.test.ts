import { describe, it, expect } from "vitest";
import {
  toCents,
  percentToBps,
  computeSplit,
  formatBRL,
  resolveCommissionBps,
  affiliateEffectivePrice,
} from "@/lib/money";

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

describe("resolveCommissionBps — comissao variavel (espelha o banco)", () => {
  // Exemplo do usuario: piso R$ 1800, alvo R$ 2100.
  const floor = 180000;
  const target = 210000;

  it("linear: cresce do piso (5%) ao alvo (15%) conforme o preco", () => {
    const base = {
      targetCents: target,
      floorCents: floor,
      commissionBps: 1500, // 15% no alvo
      commissionMinBps: 500, // 5% no piso
      model: "linear" as const,
    };
    expect(resolveCommissionBps({ ...base, saleCents: floor })).toBe(500);
    expect(resolveCommissionBps({ ...base, saleCents: target })).toBe(1500);
    expect(resolveCommissionBps({ ...base, saleCents: 195000 })).toBe(1000); // meio => 10%
    // Fora da faixa e clampado aos extremos.
    expect(resolveCommissionBps({ ...base, saleCents: 100000 })).toBe(500);
    expect(resolveCommissionBps({ ...base, saleCents: 999999 })).toBe(1500);
  });

  it("sem faixa (piso nulo / sem min): comissao constante", () => {
    expect(
      resolveCommissionBps({
        saleCents: 150000,
        targetCents: target,
        floorCents: null,
        commissionBps: 1200,
        commissionMinBps: null,
        model: "linear",
      }),
    ).toBe(1200);
  });

  it("tiers: usa o degrau de maior preco que nao excede a venda", () => {
    const tiers = [
      { min_price_cents: 180000, bps: 500 },
      { min_price_cents: 190000, bps: 1000 },
      { min_price_cents: 200000, bps: 1500 },
    ];
    const base = {
      targetCents: target,
      floorCents: floor,
      commissionBps: 1500,
      commissionMinBps: null,
      model: "tiers" as const,
      tiers,
    };
    expect(resolveCommissionBps({ ...base, saleCents: 185000 })).toBe(500);
    expect(resolveCommissionBps({ ...base, saleCents: 195000 })).toBe(1000);
    expect(resolveCommissionBps({ ...base, saleCents: 205000 })).toBe(1500);
    // Abaixo do primeiro degrau usa o mais baixo.
    expect(resolveCommissionBps({ ...base, saleCents: 100000 })).toBe(500);
  });
});

describe("affiliateEffectivePrice — clamp na faixa", () => {
  const floor = 180000;
  const target = 210000;
  it("nulo => preco-alvo; dentro => o escolhido; fora => extremos", () => {
    expect(affiliateEffectivePrice(null, target, floor)).toBe(target);
    expect(affiliateEffectivePrice(195000, target, floor)).toBe(195000);
    expect(affiliateEffectivePrice(100000, target, floor)).toBe(floor);
    expect(affiliateEffectivePrice(999999, target, floor)).toBe(target);
  });
});
