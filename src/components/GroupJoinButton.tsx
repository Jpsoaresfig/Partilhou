"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/**
 * Botao de participar/sair de um grupo. Para visitantes (nao logados), vira um
 * link para o login. Apos entrar/sair, atualiza a pagina para refletir contadores
 * e estado.
 */
export default function GroupJoinButton({
  groupId,
  authed,
  isMember,
}: {
  groupId: string;
  authed: boolean;
  isMember: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!authed) {
    return (
      <Link href="/login" className="btn btn-secondary btn-block">
        <span className="btn-ico" aria-hidden>👥</span>
        Entrar para participar
      </Link>
    );
  }

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/grupos/${groupId}/participar`, {
        method: isMember ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Nao foi possivel concluir.");
        return;
      }
      router.refresh();
    } catch {
      setError("Sem conexao. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ gap: "0.4rem" }}>
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 0 }}>
          {error}
        </div>
      )}
      <button
        type="button"
        className={`btn btn-block ${isMember ? "btn-ghost" : "btn-secondary"}`}
        onClick={toggle}
        disabled={busy}
      >
        {isMember ? (
          busy ? "Saindo..." : (<><span className="btn-ico" aria-hidden>✓</span> Participando</>)
        ) : (
          busy ? "Entrando..." : (<><span className="btn-ico" aria-hidden>👥</span> Participar</>)
        )}
      </button>
    </div>
  );
}
