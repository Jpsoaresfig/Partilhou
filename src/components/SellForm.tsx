"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { computeSplit, formatBRL, toCents, percentToBps } from "@/lib/money";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import ImageUploader from "@/components/ImageUploader";

export default function SellForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [platformFeeBps, setPlatformFeeBps] = useState(500);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [commission, setCommission] = useState("15");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "platform_fee_bps")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setPlatformFeeBps(Number(data.value));
      });
  }, []);

  const sim = useMemo(() => {
    try {
      const totalCents = toCents(amount || 0);
      const commissionBps = percentToBps(commission || 0);
      if (totalCents <= 0) return null;
      return {
        totalCents,
        withAff: computeSplit({ totalCents, commissionBps, platformFeeBps, hasAffiliate: true }),
        direct: computeSplit({ totalCents, commissionBps, platformFeeBps, hasAffiliate: false }),
      };
    } catch {
      return null;
    }
  }, [amount, commission, platformFeeBps]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          images,
          amount_total: amount,
          commission_percent: commission,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Falha ao publicar");
        return;
      }
      router.push(`/produto/${json.data.product.id}`);
      router.refresh();
    } catch {
      setError("Erro de rede");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container" style={{ maxWidth: 760, paddingTop: "2rem" }}>
      <h1>Anunciar produto</h1>
      <p className="muted mb-3">Defina o preco e quanto da venda vai para quem te indicar.</p>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="grid" style={{ gridTemplateColumns: "1fr", gap: "1.25rem" }}>
        <form onSubmit={onSubmit} className="card">
          <div className="field">
            <label>Titulo</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} />
          </div>
          <div className="field">
            <label>Descricao</label>
            <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="field">
            <label>Imagens</label>
            <ImageUploader value={images} onChange={setImages} />
          </div>
          <div className="row wrap">
            <div className="field" style={{ flex: 1, minWidth: 180 }}>
              <label>Preco (R$)</label>
              <input
                className="input"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                required
              />
            </div>
            <div className="field" style={{ flex: 1, minWidth: 180 }}>
              <label>Comissao do afiliado (%)</label>
              <input
                className="input"
                inputMode="decimal"
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                placeholder="15"
              />
            </div>
          </div>
          <button className="btn btn-primary btn-block" disabled={loading}>
            {loading ? "Publicando..." : "Publicar anuncio"}
          </button>
        </form>

        {sim && (
          <div className="card">
            <h3 style={{ marginBottom: "0.75rem" }}>Simulacao</h3>
            <div className="split-box mb-2">
              <div className="small muted" style={{ marginBottom: 4 }}>Venda por afiliado</div>
              <div className="split-line"><span>Voce recebe (liquido)</span><strong>{formatBRL(sim.withAff.sellerNetCents)}</strong></div>
              <div className="split-line"><span>Afiliado recebe</span><span>{formatBRL(sim.withAff.commissionCents)}</span></div>
              <div className="split-line"><span>Taxa da plataforma</span><span>{formatBRL(sim.withAff.platformFeeCents)}</span></div>
              <div className="split-line total"><span>Comprador paga</span><span>{formatBRL(sim.totalCents)}</span></div>
            </div>
            <div className="split-box">
              <div className="small muted" style={{ marginBottom: 4 }}>Venda direta (sem afiliado)</div>
              <div className="split-line"><span>Voce recebe (liquido)</span><strong>{formatBRL(sim.direct.sellerNetCents)}</strong></div>
              <div className="split-line"><span>Taxa da plataforma</span><span>{formatBRL(sim.direct.platformFeeCents)}</span></div>
              <div className="split-line total"><span>Comprador paga</span><span>{formatBRL(sim.totalCents)}</span></div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
