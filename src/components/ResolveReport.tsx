"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Botao do admin para marcar um reporte como resolvido (ou reabrir). */
export default function ResolveReport({
  reportId,
  status,
}: {
  reportId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolved = status === "resolvido";

  async function setStatus(next: "aberto" | "resolvido") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reports/${reportId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
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
    <div className="stack" style={{ gap: 6 }}>
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 0 }}>
          {error}
        </div>
      )}
      {resolved ? (
        <button
          className="btn btn-sm btn-ghost"
          disabled={busy}
          onClick={() => setStatus("aberto")}
        >
          Reabrir
        </button>
      ) : (
        <button
          className="btn btn-sm btn-primary"
          disabled={busy}
          onClick={() => setStatus("resolvido")}
        >
          Marcar resolvido
        </button>
      )}
    </div>
  );
}
