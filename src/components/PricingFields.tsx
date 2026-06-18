"use client";

/**
 * Campos de precificacao do anuncio: FAIXA de preco (piso + desejado) e o modelo
 * de comissao do afiliado (linear ou por faixas/tiers), com simulacao ao vivo.
 *
 * Controlado: o pai detem um `PricingValue` e recebe `onChange`. Os helpers
 * `pricingToBody` (envio) e `pricingFromProduct` (edicao) convertem de/para a API.
 * A simulacao espelha o banco via resolveCommissionBps/computeSplit.
 */
import { useMemo } from "react";
import {
  computeSplit,
  formatBRL,
  toCents,
  percentToBps,
  bpsToPercent,
  resolveCommissionBps,
  type CommissionModel,
  type CommissionTier,
} from "@/lib/money";

export type PricingTier = { price: string; percent: string };

export type PricingValue = {
  target: string; // preco desejado / alvo (reais)
  min: string; // piso (reais); "" => preco fixo (= alvo)
  model: CommissionModel;
  commissionMax: string; // % no alvo (linear)
  commissionMin: string; // % no piso (linear)
  tiers: PricingTier[];
};

export const EMPTY_PRICING: PricingValue = {
  target: "",
  min: "",
  model: "linear",
  commissionMax: "15",
  commissionMin: "5",
  tiers: [],
};

/** Converte o estado da UI para o corpo aceito por /api/products. */
export function pricingToBody(v: PricingValue) {
  const hasFloor = v.min.trim() !== "";
  const body: Record<string, unknown> = {
    amount_total: v.target,
    commission_model: v.model,
  };
  if (hasFloor) body.min_price = v.min;

  if (v.model === "tiers") {
    const tiers = v.tiers.filter((t) => t.price.trim() !== "" && t.percent.trim() !== "");
    body.commission_tiers = tiers.map((t) => ({ price: t.price, percent: t.percent }));
    // commission_percent (no alvo) e obrigatorio: usa a maior comissao dos degraus.
    const maxPct = tiers.reduce((m, t) => Math.max(m, Number(t.percent.replace(",", ".")) || 0), 0);
    body.commission_percent = String(maxPct);
  } else {
    body.commission_percent = v.commissionMax;
    if (hasFloor) body.commission_min_percent = v.commissionMin;
  }
  return body;
}

type ProductLike = {
  amount_total_cents: number;
  min_price_cents?: number | null;
  commission_bps: number;
  commission_min_bps?: number | null;
  commission_model?: CommissionModel | null;
  commission_tiers?: CommissionTier[] | null;
};

/** Reconstroi o estado da UI a partir de um produto existente (edicao). */
export function pricingFromProduct(p: ProductLike): PricingValue {
  const reais = (c: number) => (c / 100).toFixed(2);
  const model: CommissionModel = p.commission_model === "tiers" ? "tiers" : "linear";
  return {
    target: reais(p.amount_total_cents),
    min: p.min_price_cents != null ? reais(p.min_price_cents) : "",
    model,
    commissionMax: String(bpsToPercent(p.commission_bps)),
    commissionMin: String(bpsToPercent(p.commission_min_bps ?? p.commission_bps)),
    tiers:
      p.commission_tiers?.map((t) => ({
        price: reais(t.min_price_cents),
        percent: String(bpsToPercent(t.bps)),
      })) ?? [],
  };
}

function safeCents(reais: string): number | null {
  try {
    const c = toCents(reais || 0);
    return c > 0 ? c : null;
  } catch {
    return null;
  }
}

function safeBps(percent: string): number {
  try {
    return percentToBps(percent || 0);
  } catch {
    return 0;
  }
}

export default function PricingFields({
  value,
  onChange,
  platformFeeBps,
}: {
  value: PricingValue;
  onChange: (next: PricingValue) => void;
  platformFeeBps: number;
}) {
  const v = value;
  const set = (patch: Partial<PricingValue>) => onChange({ ...v, ...patch });

  function switchModel(model: CommissionModel) {
    if (model === "tiers" && v.tiers.length === 0) {
      // Semente: um degrau no piso (ou alvo) com a comissao minima atual.
      set({
        model,
        tiers: [{ price: v.min.trim() || v.target, percent: v.commissionMin || "10" }],
      });
    } else {
      set({ model });
    }
  }

  function setTier(i: number, patch: Partial<PricingTier>) {
    const tiers = v.tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t));
    set({ tiers });
  }
  function addTier() {
    set({ tiers: [...v.tiers, { price: "", percent: "" }] });
  }
  function removeTier(i: number) {
    set({ tiers: v.tiers.filter((_, idx) => idx !== i) });
  }

  // ----- Simulacao -----
  const sim = useMemo(() => {
    const targetCents = safeCents(v.target);
    if (!targetCents) return null;
    const floorCents = v.min.trim() !== "" ? safeCents(v.min) : null;
    const commissionBps = safeBps(v.commissionMax);
    const commissionMinBps = floorCents != null ? safeBps(v.commissionMin) : null;
    const tiers: CommissionTier[] =
      v.model === "tiers"
        ? v.tiers
            .filter((t) => t.price.trim() !== "" && t.percent.trim() !== "")
            .map((t) => ({ min_price_cents: safeCents(t.price) ?? 0, bps: safeBps(t.percent) }))
        : [];

    const at = (priceCents: number) => {
      const bps = resolveCommissionBps({
        saleCents: priceCents,
        targetCents,
        floorCents,
        commissionBps,
        commissionMinBps,
        model: v.model,
        tiers,
      });
      return {
        priceCents,
        bps,
        ...computeSplit({ totalCents: priceCents, commissionBps: bps, platformFeeBps, hasAffiliate: true }),
      };
    };

    const floorPrice = floorCents ?? targetCents;
    return {
      hasRange: floorCents != null && floorCents < targetCents,
      low: at(floorPrice),
      high: at(targetCents),
      direct: computeSplit({ totalCents: targetCents, commissionBps, platformFeeBps, hasAffiliate: false }),
      targetCents,
    };
  }, [v, platformFeeBps]);

  return (
    <div className="stack">
      {/* Faixa de preco */}
      <div className="row wrap">
        <div className="field" style={{ flex: 1, minWidth: 180 }}>
          <label>Preco desejado (R$)</label>
          <input
            className="input"
            inputMode="decimal"
            value={v.target}
            onChange={(e) => set({ target: e.target.value })}
            placeholder="0,00"
            required
          />
          <span className="small muted">Quanto um comprador direto paga (e o teto do afiliado).</span>
        </div>
        <div className="field" style={{ flex: 1, minWidth: 180 }}>
          <label>Aceito vender a partir de (R$)</label>
          <input
            className="input"
            inputMode="decimal"
            value={v.min}
            onChange={(e) => set({ min: e.target.value })}
            placeholder="opcional — deixe vazio p/ preco fixo"
          />
          <span className="small muted">Piso da faixa. O afiliado pode anunciar entre o piso e o desejado.</span>
        </div>
      </div>

      {/* Modelo de comissao */}
      <div className="field">
        <label>Comissao do afiliado</label>
        <div className="row" style={{ gap: 8 }}>
          <button
            type="button"
            className={`btn btn-sm ${v.model === "linear" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => switchModel("linear")}
          >
            Linear (cresce com o preco)
          </button>
          <button
            type="button"
            className={`btn btn-sm ${v.model === "tiers" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => switchModel("tiers")}
          >
            Por faixas (degraus)
          </button>
        </div>
      </div>

      {v.model === "linear" ? (
        <div className="row wrap">
          {v.min.trim() !== "" && (
            <div className="field" style={{ flex: 1, minWidth: 160 }}>
              <label>Comissao no preco minimo (%)</label>
              <input
                className="input"
                inputMode="decimal"
                value={v.commissionMin}
                onChange={(e) => set({ commissionMin: e.target.value })}
                placeholder="5"
              />
            </div>
          )}
          <div className="field" style={{ flex: 1, minWidth: 160 }}>
            <label>{v.min.trim() !== "" ? "Comissao no preco desejado (%)" : "Comissao do afiliado (%)"}</label>
            <input
              className="input"
              inputMode="decimal"
              value={v.commissionMax}
              onChange={(e) => set({ commissionMax: e.target.value })}
              placeholder="15"
            />
          </div>
        </div>
      ) : (
        <div className="split-box stack">
          <div className="small muted">A partir de cada preco de venda, paga a comissao indicada.</div>
          {v.tiers.map((t, i) => (
            <div className="row" key={i} style={{ gap: 8, alignItems: "flex-end" }}>
              <div className="field" style={{ margin: 0, flex: 1 }}>
                <label className="small">A partir de (R$)</label>
                <input
                  className="input"
                  inputMode="decimal"
                  value={t.price}
                  onChange={(e) => setTier(i, { price: e.target.value })}
                  placeholder="1800,00"
                />
              </div>
              <div className="field" style={{ margin: 0, flex: "0 0 30%" }}>
                <label className="small">Comissao (%)</label>
                <input
                  className="input"
                  inputMode="decimal"
                  value={t.percent}
                  onChange={(e) => setTier(i, { percent: e.target.value })}
                  placeholder="10"
                />
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => removeTier(i)}
                aria-label="Remover faixa"
              >
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-sm btn-ghost" onClick={addTier}>
            + Adicionar faixa
          </button>
        </div>
      )}

      {/* Simulacao */}
      {sim && (
        <div className="split-box">
          <h4 style={{ margin: "0 0 0.5rem" }}>Simulacao</h4>
          {sim.hasRange ? (
            <>
              <div className="small muted" style={{ marginBottom: 4 }}>
                Se o afiliado vender no <strong>minimo</strong> ({formatBRL(sim.low.priceCents)})
              </div>
              <div className="split-line"><span>Comissao do afiliado</span><strong>{formatBRL(sim.low.commissionCents)} · {bpsToPercent(sim.low.bps)}%</strong></div>
              <div className="split-line"><span>Voce recebe (liquido)</span><span>{formatBRL(sim.low.sellerNetCents)}</span></div>

              <div className="small muted" style={{ margin: "10px 0 4px" }}>
                Se o afiliado vender no <strong>desejado</strong> ({formatBRL(sim.high.priceCents)})
              </div>
              <div className="split-line"><span>Comissao do afiliado</span><strong>{formatBRL(sim.high.commissionCents)} · {bpsToPercent(sim.high.bps)}%</strong></div>
              <div className="split-line"><span>Voce recebe (liquido)</span><span>{formatBRL(sim.high.sellerNetCents)}</span></div>
            </>
          ) : (
            <>
              <div className="small muted" style={{ marginBottom: 4 }}>Venda por afiliado</div>
              <div className="split-line"><span>Comissao do afiliado</span><strong>{formatBRL(sim.high.commissionCents)} · {bpsToPercent(sim.high.bps)}%</strong></div>
              <div className="split-line"><span>Voce recebe (liquido)</span><span>{formatBRL(sim.high.sellerNetCents)}</span></div>
            </>
          )}
          <div className="split-line total" style={{ marginTop: 8 }}>
            <span>Venda direta — voce recebe</span>
            <span>{formatBRL(sim.direct.sellerNetCents)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
