"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Icon, { type IconName } from "./icons";

/** Item do header: ícone (linha) em cima, nome embaixo (estilo Facebook). */
function NavItem({
  href,
  icon,
  label,
  badge,
  active,
  onClick,
}: {
  href: string;
  icon: IconName;
  label: string;
  badge?: number;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link href={href} className={`nav-item${active ? " active" : ""}`} onClick={onClick}>
      <span className="nav-ico">
        <Icon name={icon} />
        {badge && badge > 0 ? (
          <span className="nav-badge">{badge > 99 ? "99+" : badge}</span>
        ) : null}
      </span>
      <span className="nav-label">{label}</span>
    </Link>
  );
}

export default function Navbar({
  authed,
  isAdmin,
  unread = 0,
  showGroups = false,
}: {
  authed: boolean;
  isAdmin?: boolean;
  unread?: number;
  showGroups?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  async function logout() {
    setOpen(false);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const close = () => setOpen(false);
  const is = (p: string) => (p === "/" ? pathname === "/" : pathname.startsWith(p));

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
          <NavItem href="/" icon="home" label="Início" active={is("/")} onClick={close} />
          {showGroups && (
            <NavItem href="/grupos" icon="users" label="Grupos" active={is("/grupos")} onClick={close} />
          )}

          {authed ? (
            <>
              <NavItem href="/painel" icon="store" label="Painel" active={is("/painel")} onClick={close} />
              <NavItem href="/carteira" icon="wallet" label="Carteira" active={is("/carteira")} onClick={close} />
              <NavItem
                href="/notificacoes"
                icon="bell"
                label="Notificações"
                badge={unread}
                active={is("/notificacoes")}
                onClick={close}
              />
              <NavItem href="/perfil" icon="user" label="Perfil" active={is("/perfil")} onClick={close} />
              {isAdmin && (
                <NavItem href="/admin" icon="shield" label="Admin" active={is("/admin")} onClick={close} />
              )}
              <button className="nav-item" onClick={logout}>
                <span className="nav-ico">
                  <Icon name="logout" />
                </span>
                <span className="nav-label">Sair</span>
              </button>
            </>
          ) : (
            <>
              <NavItem href="/login" icon="login" label="Entrar" active={is("/login")} onClick={close} />
              <span className="nav-sell">
                <Link href="/registrar" className="btn btn-primary btn-sm" onClick={close}>
                  Criar conta
                </Link>
              </span>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
