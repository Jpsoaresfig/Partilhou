"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/** Erros por campo retornados pela API (Zod flatten -> fieldErrors). */
type FieldErrors = Record<string, string[] | undefined>;

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    setFieldErrors({});

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
        // Erro de validacao (422): mostra a mensagem sob cada campo.
        const fe = json.details?.fieldErrors as FieldErrors | undefined;
        if (fe && Object.keys(fe).length > 0) {
          setFieldErrors(fe);
          setError("Confira os campos destacados.");
        } else {
          setError(json.error ?? "Nao foi possivel concluir. Tente novamente.");
        }
        return;
      }

      if (mode === "register" && json.data?.needs_email_confirmation) {
        setInfo("Conta criada! Confirme seu e-mail para entrar.");
        return;
      }
      router.push("/painel");
      router.refresh();
    } catch {
      setError("Sem conexao. Verifique sua internet e tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  // Primeira mensagem de erro de um campo (ou undefined).
  const fieldError = (name: string) => fieldErrors[name]?.[0];

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

        <form onSubmit={onSubmit} noValidate>
          {mode === "register" && (
            <>
              <Field label="Nome completo" name="full_name" error={fieldError("full_name")}>
                <input
                  id="full_name"
                  className={inputClass(fieldError("full_name"))}
                  name="full_name"
                  autoComplete="name"
                  aria-invalid={!!fieldError("full_name")}
                />
              </Field>
              <Field
                label="CPF/CNPJ (para repasses)"
                name="document_number"
                error={fieldError("document_number")}
                hint="Opcional agora. Necessario para receber repasses."
              >
                <input
                  id="document_number"
                  className={inputClass(fieldError("document_number"))}
                  name="document_number"
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  aria-invalid={!!fieldError("document_number")}
                />
              </Field>
              <Field label="Telefone" name="phone" error={fieldError("phone")}>
                <input
                  id="phone"
                  className={inputClass(fieldError("phone"))}
                  name="phone"
                  placeholder="(11) 90000-0000"
                  autoComplete="tel"
                  inputMode="tel"
                  aria-invalid={!!fieldError("phone")}
                />
              </Field>
            </>
          )}

          <Field label="E-mail" name="email" error={fieldError("email")}>
            <input
              id="email"
              className={inputClass(fieldError("email"))}
              type="email"
              name="email"
              autoComplete="email"
              aria-invalid={!!fieldError("email")}
            />
          </Field>

          <Field label="Senha" name="password" error={fieldError("password")}>
            <input
              id="password"
              className={inputClass(fieldError("password"))}
              type="password"
              name="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              aria-invalid={!!fieldError("password")}
            />
          </Field>

          <button className="btn btn-primary btn-block" disabled={loading}>
            {loading ? "Enviando..." : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <p className="small muted mt-2 center">
          {mode === "login" ? (
            <>
              Nao tem conta?{" "}
              <Link href="/registrar" style={{ color: "var(--primary)" }}>
                Cadastre-se
              </Link>
            </>
          ) : (
            <>
              Ja tem conta?{" "}
              <Link href="/login" style={{ color: "var(--primary)" }}>
                Entrar
              </Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}

function inputClass(error?: string) {
  return error ? "input invalid" : "input";
}

/** Wrapper de campo: rotulo, conteudo, dica opcional e erro inline. */
function Field({
  label,
  name,
  error,
  hint,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      {children}
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : (
        hint && <span className="field-hint">{hint}</span>
      )}
    </div>
  );
}
