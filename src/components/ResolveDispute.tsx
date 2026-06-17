"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ResolveDispute({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolve(outcome: "liberar" | "estornar") {
    if (!confirm(`Confirmar: ${outcome === "liberar" ? "liberar ao vendedor/afiliado" : "estornar ao comprador"}?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
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
      {error && <div className="alert alert-error" style={{ marginBottom: 0 }}>{error}</div>}
      <div className="row">
        <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => resolve("liberar")}>
          Liberar
        </button>
        <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => resolve("estornar")}>
          Estornar
        </button>
      </div>
    </div>
  );
}
