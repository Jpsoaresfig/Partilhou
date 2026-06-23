"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Liga/desliga uma flag de `platform_settings` pelo painel admin.
 * Persiste via POST /api/admin/settings e recarrega a pagina.
 */
export default function FeatureToggle({
  settingKey,
  enabled,
  labelOn = "Ativado",
  labelOff = "Desativado",
}: {
  settingKey: string;
  enabled: boolean;
  labelOn?: string;
  labelOff?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !enabled;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: settingKey, value: next ? "true" : "false" }),
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
    <div className="row wrap" style={{ gap: 10, alignItems: "center" }}>
      <span className={`badge ${enabled ? "badge-primary" : "badge-warn"}`}>
        {enabled ? labelOn : labelOff}
      </span>
      <button
        className={`btn btn-sm ${enabled ? "btn-danger" : "btn-primary"}`}
        disabled={busy}
        onClick={toggle}
      >
        {busy ? "Salvando…" : enabled ? "Desativar" : "Ativar"}
      </button>
      {error && (
        <span className="field-error" style={{ marginBottom: 0 }}>
          {error}
        </span>
      )}
    </div>
  );
}
