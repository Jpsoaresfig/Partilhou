"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./icons";

/**
 * Barra de navegacao inferior — visivel apenas no mobile (escondida via CSS no
 * desktop). Atalhos: Inicio, Conversa e Adicionar (anunciar produto).
 */
export default function MobileTabBar({ unread = 0 }: { unread?: number }) {
  const pathname = usePathname();
  const is = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="mobile-tabbar" aria-label="Navegação rápida">
      <Link href="/" className={`mtab${is("/") ? " active" : ""}`}>
        <Icon name="home" size={22} />
        <span>Início</span>
      </Link>

      <Link href="/chat" className={`mtab${is("/chat") ? " active" : ""}`}>
        <span className="mtab-ic">
          <Icon name="chat" size={22} />
          {unread > 0 && (
            <span className="mtab-badge">{unread > 99 ? "99+" : unread}</span>
          )}
        </span>
        <span>Conversa</span>
      </Link>

      <Link href="/vender" className={`mtab${is("/vender") ? " active" : ""}`}>
        <Icon name="plus" size={24} />
        <span>Adicionar</span>
      </Link>
    </nav>
  );
}
