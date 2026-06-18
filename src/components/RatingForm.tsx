"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Role = "vendedor" | "afiliado";

export type RatingTarget = {
  role: Role;
  label: string;
  existing?: { score: number; comment: string | null } | null;
};

function StarPicker({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="row" style={{ gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
          onClick={() => onChange(n)}
          style={{
            background: "none",
            border: "none",
            cursor: disabled ? "default" : "pointer",
            fontSize: "1.6rem",
            lineHeight: 1,
            padding: 0,
            color: n <= value ? "var(--accent)" : "var(--border, #2a2f3a)",
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function TargetCard({ orderId, target }: { orderId: string; target: RatingTarget }) {
  const router = useRouter();
  const [score, setScore] = useState(target.existing?.score ?? 0);
  const [comment, setComment] = useState(target.existing?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(Boolean(target.existing));

  async function submit() {
    if (score < 1) {
      setError("Escolha de 1 a 5 estrelas.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: target.role,
          score,
          comment: comment.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Falha ao enviar avaliacao");
        return;
      }
      setDone(true);
      router.refresh();
    } catch {
      setError("Erro de rede");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="split-box stack">
      <div className="row between">
        <strong>{target.label}</strong>
        {done && <span className="badge badge-primary">Avaliado</span>}
      </div>
      {error && <div className="alert alert-error" style={{ marginBottom: 0 }}>{error}</div>}
      <StarPicker value={score} onChange={setScore} disabled={busy} />
      <div className="field" style={{ margin: 0 }}>
        <textarea
          className="textarea"
          style={{ minHeight: 60 }}
          value={comment}
          maxLength={1000}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Comentario (opcional)"
        />
      </div>
      <button className="btn btn-primary btn-sm" disabled={busy || score < 1} onClick={submit}>
        {busy ? "Enviando..." : done ? "Atualizar avaliacao" : "Enviar avaliacao"}
      </button>
    </div>
  );
}

export default function RatingForm({
  orderId,
  targets,
}: {
  orderId: string;
  targets: RatingTarget[];
}) {
  if (targets.length === 0) return null;
  return (
    <div className="stack">
      {targets.map((t) => (
        <TargetCard key={t.role} orderId={orderId} target={t} />
      ))}
    </div>
  );
}
