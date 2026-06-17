"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    const form = new FormData(e.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Falha na operacao");
        return;
      }
      if (mode === "register" && json.data?.needs_email_confirmation) {
        setInfo("Conta criada! Confirme seu e-mail para entrar.");
        return;
      }
      router.push("/painel");
      router.refresh();
    } catch {
      setError("Erro de rede");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container" style={{ maxWidth: 440, paddingTop: "3rem" }}>
      <div className="card">
        <h1>{mode === "login" ? "Entrar" : "Criar conta"}</h1>
        <p className="muted small mb-2">
          {mode === "login"
            ? "Acesse para comprar, vender ou afiliar."
            : "Uma conta para vender, comprar e afiliar."}
        </p>

        {error && <div className="alert alert-error">{error}</div>}
        {info && <div className="alert alert-ok">{info}</div>}

        <form onSubmit={onSubmit}>
          {mode === "register" && (
            <>
              <div className="field">
                <label>Nome completo</label>
                <input className="input" name="full_name" required minLength={2} />
              </div>
              <div className="field">
                <label>CPF/CNPJ (para repasses)</label>
                <input className="input" name="document_number" placeholder="000.000.000-00" />
              </div>
              <div className="field">
                <label>Telefone</label>
                <input className="input" name="phone" placeholder="(11) 90000-0000" />
              </div>
            </>
          )}
          <div className="field">
            <label>E-mail</label>
            <input className="input" type="email" name="email" required />
          </div>
          <div className="field">
            <label>Senha</label>
            <input className="input" type="password" name="password" required minLength={8} />
          </div>
          <button className="btn btn-primary btn-block" disabled={loading}>
            {loading ? "Enviando..." : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <p className="small muted mt-2 center">
          {mode === "login" ? (
            <>
              Nao tem conta? <Link href="/registrar" style={{ color: "var(--primary)" }}>Cadastre-se</Link>
            </>
          ) : (
            <>
              Ja tem conta? <Link href="/login" style={{ color: "var(--primary)" }}>Entrar</Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
