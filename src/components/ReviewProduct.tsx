"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Controles do admin para moderar um anuncio: define o score de confianca e
 * decide Aprovar / Parcial / Rejeitar. Chama POST /api/admin/products/:id/review.
 */
export default function ReviewProduct({
  productId,
  reviewStatus,
  trustScore,
}: {
  productId: string;
  reviewStatus: string;
  trustScore: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState(trustScore || 80);

  async function decide(decision: "approved" | "partial" | "unverified" | "rejected") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${productId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          trust_score: decision === "rejected" ? 0 : score,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Falha");
        return;
      }
      router.refresh();
    } catch {
      setError("Erro de rede");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ gap: 6, alignItems: "flex-end" }}>
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 0 }}>
          {error}
        </div>
      )}
      <div className="row" style={{ gap: 6, alignItems: "center" }}>
        <label className="muted small" htmlFor={`score-${productId}`}>
          Score
        </label>
        <input
          id={`score-${productId}`}
          className="input"
          type="number"
          min={0}
          max={100}
          value={score}
          onChange={(e) => setScore(Math.max(0, Math.min(100, Number(e.target.value))))}
          style={{ width: 72 }}
        />
      </div>
      <div className="row" style={{ gap: 6 }}>
        <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => decide("approved")}>
          🟢 Verificar
        </button>
        <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => decide("partial")}>
          🟡 Parcial
        </button>
        <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => decide("unverified")}>
          🔴 Nao verif.
        </button>
        <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => decide("rejected")}>
          ⛔ Rejeitar
        </button>
      </div>
    </div>
  );
}
