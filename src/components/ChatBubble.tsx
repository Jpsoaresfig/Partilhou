"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./icons";

/**
 * Bolinha de chat flutuante (canto inferior direito). Mostra o numero de
 * mensagens nao lidas. Some quando o usuario ja esta dentro do chat.
 */
export default function ChatBubble({ unread = 0 }: { unread?: number }) {
  const pathname = usePathname();
  if (pathname.startsWith("/chat")) return null;

  return (
    <span className="chat-fab-wrap">
      <Link href="/chat" className="chat-fab" aria-label="Abrir conversas">
        <Icon name="chat" size={26} />
        {unread > 0 && (
          <span className="chat-fab-badge">{unread > 99 ? "99+" : unread}</span>
        )}
      </Link>
      <span className="chat-fab-label">
        {unread > 0 ? `${unread} mensagem(ns) nova(s)` : "Conversas"}
      </span>
    </span>
  );
}
