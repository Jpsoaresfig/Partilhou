"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GROUP_THEMES } from "@/lib/groups";
import { UFS } from "@/lib/regions";

type FieldErrors = Record<string, string[] | undefined>;

/** Formulario de criacao de grupo. Posta em /api/grupos e volta para /grupos. */
export default function CreateGroupForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [theme, setTheme] = useState("geral");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});

    const form = new FormData(e.currentTarget);
    const payload = Object.fromEntries(form.entries());

    try {
      const res = await fetch("/api/grupos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok) {
        const fe = json.details?.fieldErrors as FieldErrors | undefined;
        if (fe && Object.keys(fe).length > 0) {
          setFieldErrors(fe);
          setError("Confira os campos destacados.");
        } else {
          setError(json.error ?? "Nao foi possivel criar o grupo.");
        }
        return;
      }
      router.push("/grupos");
      router.refresh();
    } catch {
      setError("Sem conexao. Verifique sua internet e tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  const fieldError = (name: string) => fieldErrors[name]?.[0];

  return (
    <form onSubmit={onSubmit} noValidate>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="field">
        <label htmlFor="name">Nome do grupo</label>
        <input
          id="name"
          name="name"
          className={fieldError("name") ? "input invalid" : "input"}
          placeholder="Ex: Achados e Promocoes"
          maxLength={80}
          aria-invalid={!!fieldError("name")}
        />
        {fieldError("name") && (
          <span className="field-error" role="alert">{fieldError("name")}</span>
        )}
      </div>

      <div className="field">
        <label htmlFor="description">Descricao</label>
        <textarea
          id="description"
          name="description"
          className={fieldError("description") ? "textarea invalid" : "textarea"}
          placeholder="Do que e o grupo? O que pode ser compartilhado aqui?"
          maxLength={500}
          aria-invalid={!!fieldError("description")}
        />
        {fieldError("description") && (
          <span className="field-error" role="alert">{fieldError("description")}</span>
        )}
      </div>

      <div className="cols-2">
        <div className="field">
          <label htmlFor="theme">Tema</label>
          <select id="theme" name="theme" value={theme} onChange={(e) => setTheme(e.target.value)}>
            {GROUP_THEMES.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.icon} {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="visibility">Visibilidade</label>
          <select id="visibility" name="visibility" defaultValue="publico">
            <option value="publico">Publico — qualquer um participa</option>
            <option value="privado">Privado — so por convite</option>
          </select>
        </div>
      </div>

      <div className="cols-2">
        <div className="field">
          <label htmlFor="icon">Icone (emoji)</label>
          <input
            id="icon"
            name="icon"
            className="input"
            placeholder="🔥"
            maxLength={8}
          />
          <span className="field-hint">Opcional. Em branco, usa o icone do tema.</span>
        </div>
        {theme === "regionais" && (
          <div className="field">
            <label htmlFor="region_uf">Regiao (UF)</label>
            <select
              id="region_uf"
              name="region_uf"
              defaultValue=""
              className={fieldError("region_uf") ? "invalid" : undefined}
            >
              <option value="">Selecione</option>
              {UFS.map((u) => (
                <option key={u.uf} value={u.uf}>
                  {u.uf} — {u.name}
                </option>
              ))}
            </select>
            {fieldError("region_uf") && (
              <span className="field-error" role="alert">{fieldError("region_uf")}</span>
            )}
          </div>
        )}
      </div>

      <button className="btn btn-primary btn-block mt-1" disabled={loading}>
        <span className="btn-ico" aria-hidden>➕</span>
        {loading ? "Criando..." : "Criar grupo"}
      </button>
    </form>
  );
}
