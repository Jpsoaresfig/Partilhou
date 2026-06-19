"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Navbar({ authed, isAdmin, unread = 0 }: { authed: boolean; isAdmin?: boolean; unread?: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    setOpen(false);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const close = () => setOpen(false);

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="brand" onClick={close}>
          <span className="dot" /> Partilhou
        </Link>

        <button
          className="nav-toggle"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "✕" : "☰"}
        </button>

        <div className={`nav-links ${open ? "open" : "closed"}`}>
          <Link href="/" onClick={close}>Explorar</Link>
          <Link href="/grupos" onClick={close}>Grupos</Link>
          {authed ? (
            <>
              <Link href="/vender" onClick={close}>Vender</Link>
              <Link href="/painel" onClick={close}>Painel</Link>
              <Link href="/chat" onClick={close}>Conversas</Link>
              <Link href="/carteira" onClick={close}>Carteira</Link>
              <Link href="/notificacoes" onClick={close} className="nav-notif">
                Notificacoes
                {unread > 0 && <span className="nav-badge">{unread > 9 ? "9+" : unread}</span>}
              </Link>
              <Link href="/perfil" onClick={close}>Perfil</Link>
              {isAdmin && <Link href="/admin" onClick={close}>Admin</Link>}
              <button onClick={logout}>Sair</button>
            </>
          ) : (
            <>
              <Link href="/login" onClick={close}>Entrar</Link>
              <Link href="/registrar" className="btn btn-primary btn-sm" style={{ color: "#06231b" }} onClick={close}>
                Criar conta
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
