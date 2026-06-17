"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatBRL } from "@/lib/money";

export default function WithdrawForm({ availableCents }: { availableCents: number }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(false);
    try {
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, pix_key: pixKey }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Falha ao solicitar saque");
        return;
      }
      setOk(true);
      setAmount("");
      router.refresh();
    } catch {
      setError("Erro de rede");
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || availableCents <= 0;

  return (
    <form onSubmit={submit} className="stack">
      {error && <div className="alert alert-error" style={{ marginBottom: 0 }}>{error}</div>}
      {ok && <div className="alert alert-ok" style={{ marginBottom: 0 }}>Saque solicitado!</div>}
      <div className="field" style={{ margin: 0 }}>
        <label>Valor (disponivel: {formatBRL(availableCents)})</label>
        <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" required />
      </div>
      <div className="field" style={{ margin: 0 }}>
        <label>Chave PIX</label>
        <input className="input" value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="email, CPF, telefone ou aleatoria" required />
      </div>
      <button className="btn btn-primary" disabled={disabled}>
        {busy ? "Solicitando..." : "Solicitar saque"}
      </button>
    </form>
  );
}
