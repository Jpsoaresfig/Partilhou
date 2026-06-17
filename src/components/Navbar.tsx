"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Navbar({ authed, isAdmin }: { authed: boolean; isAdmin?: boolean }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="brand">
          <span className="dot" /> Partilhou
        </Link>
        <div className="nav-links">
          <Link href="/">Explorar</Link>
          {authed ? (
            <>
              <Link href="/vender">Vender</Link>
              <Link href="/painel">Painel</Link>
              <Link href="/carteira">Carteira</Link>
              <Link href="/perfil">Perfil</Link>
              {isAdmin && <Link href="/admin">Admin</Link>}
              <button onClick={logout}>Sair</button>
            </>
          ) : (
            <>
              <Link href="/login">Entrar</Link>
              <Link href="/registrar" className="btn btn-primary btn-sm" style={{ color: "#06231b" }}>
                Criar conta
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
