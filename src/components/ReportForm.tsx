"use client";

import { useState } from "react";

const CATEGORIES = [
  { value: "pagamento", label: "Pagamento / carteira" },
  { value: "conta", label: "Minha conta / login" },
  { value: "anuncio", label: "Anúncio com problema" },
  { value: "abuso", label: "Abuso / golpe / conteúdo impróprio" },
  { value: "bug", label: "Erro no site (bug)" },
  { value: "outro", label: "Outro" },
];

export default function ReportForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const payload = Object.fromEntries(form.entries());
    // Anexa a pagina anterior (ajuda a equipe a reproduzir).
    if (typeof document !== "undefined" && document.referrer) {
      (payload as Record<string, string>).url = document.referrer;
    }

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Não foi possível enviar. Tente novamente.");
        return;
      }
      setDone(true);
    } catch {
      setError("Sem conexão. Verifique sua internet e tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="card mt-2">
        <div className="alert alert-ok" style={{ marginBottom: 0 }}>
          Relato enviado! Obrigado por ajudar a melhorar a Partilhou. 💚
        </div>
      </div>
    );
  }

  return (
    <form className="card mt-2" onSubmit={onSubmit}>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="field">
        <label htmlFor="category">Tipo de problema</label>
        <select id="category" name="category" defaultValue="outro">
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="message">O que aconteceu?</label>
        <textarea
          id="message"
          name="message"
          className="textarea"
          placeholder="Descreva o problema com o máximo de detalhes possível."
          minLength={10}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="email">E-mail para resposta (opcional)</label>
        <input
          id="email"
          name="email"
          type="email"
          className="input"
          placeholder="voce@email.com"
          autoComplete="email"
        />
        <span className="field-hint">
          Se estiver logado, usamos o e-mail da sua conta automaticamente.
        </span>
      </div>

      <button className="btn btn-primary btn-block" disabled={loading}>
        {loading ? "Enviando..." : "Enviar relato"}
      </button>
    </form>
  );
}
