"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Abre (ou reaproveita) a conversa com o vendedor e navega ate a thread. */
export default function ChatButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/chat/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Falha ao abrir conversa");
        return;
      }
      router.push(`/chat/${json.data.conversation.id}`);
    } catch {
      setError("Erro de rede");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      {error && <div className="alert alert-error" style={{ marginBottom: 0 }}>{error}</div>}
      <button className="btn btn-ghost btn-block" onClick={start} disabled={busy}>
        {busy ? "Abrindo..." : "Conversar com o vendedor"}
      </button>
    </div>
  );
}
