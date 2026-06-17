"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Role = "seller" | "buyer" | "affiliate";

export default function OrderActions({
  orderId,
  role,
  paymentStatus,
  deliveryStatus,
  fundsState,
}: {
  orderId: string;
  role: Role;
  paymentStatus: string;
  deliveryStatus: string;
  fundsState: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tracking, setTracking] = useState("");
  const [reason, setReason] = useState("");
  const [showDispute, setShowDispute] = useState(false);

  async function call(path: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Falha na operacao");
        return;
      }
      router.refresh();
    } catch {
      setError("Erro de rede");
    } finally {
      setBusy(false);
    }
  }

  const canShip = role === "seller" && fundsState === "retido" && deliveryStatus === "aguardando_envio";
  const canConfirm = role === "buyer" && fundsState === "retido" && deliveryStatus !== "aguardando_envio";
  const canDispute = role === "buyer" && fundsState === "retido" && paymentStatus !== "em_disputa";

  if (!canShip && !canConfirm && !canDispute) {
    return <p className="muted small">Nenhuma acao disponivel para voce neste momento.</p>;
  }

  return (
    <div className="stack">
      {error && <div className="alert alert-error" style={{ marginBottom: 0 }}>{error}</div>}

      {canShip && (
        <div className="split-box stack">
          <div className="field" style={{ margin: 0 }}>
            <label>Codigo de rastreio (opcional)</label>
            <input className="input" value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="BR123456789" />
          </div>
          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={() => call(`/api/orders/${orderId}/ship`, { tracking_code: tracking || undefined })}
          >
            Marcar como enviado
          </button>
        </div>
      )}

      {canConfirm && (
        <button
          className="btn btn-primary"
          disabled={busy}
          onClick={() => call(`/api/orders/${orderId}/confirm-delivery`)}
        >
          Recebi e esta tudo ok (liberar pagamento)
        </button>
      )}

      {canDispute && !showDispute && (
        <button className="btn btn-danger" disabled={busy} onClick={() => setShowDispute(true)}>
          Abrir disputa
        </button>
      )}

      {canDispute && showDispute && (
        <div className="split-box stack">
          <div className="field" style={{ margin: 0 }}>
            <label>Descreva o problema</label>
            <textarea
              className="textarea"
              style={{ minHeight: 80 }}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Nao recebi / produto com defeito..."
            />
          </div>
          <div className="row">
            <button
              className="btn btn-danger"
              disabled={busy || reason.trim().length < 5}
              onClick={() => call(`/api/orders/${orderId}/dispute`, { reason })}
            >
              Enviar disputa
            </button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => setShowDispute(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
