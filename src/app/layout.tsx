import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import ChatBubble from "@/components/ChatBubble";
import { getServerUser } from "@/lib/supabase/server";
import { groupsEnabled } from "@/lib/flags";

export const metadata: Metadata = {
  title: "Partilhou — Marketplace C2C com afiliacao",
  description:
    "Compre, venda e indique produtos usados com pagamento garantido (escrow).",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#18191a",
};

// Aplica o tema salvo ANTES do paint (evita "flash"). Padrao: escuro (estilo Facebook).
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark')t='dark';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { supabase, user } = await getServerUser();
  const showGroups = await groupsEnabled();

  let unread = 0;
  let unreadChat = 0;
  if (user) {
    // Presenca, notificacoes nao lidas e mensagens de chat nao lidas — em paralelo.
    const [, { count: notifCount }, { count: chatCount }] = await Promise.all([
      supabase.rpc("touch_presence"),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null),
      supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .neq("sender_id", user.id)
        .is("read_at", null),
    ]);
    unread = notifCount ?? 0;
    unreadChat = chatCount ?? 0;
  }

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <Navbar
          authed={!!user}
          isAdmin={user?.app_metadata?.is_admin === true}
          unread={unread}
          showGroups={showGroups}
        />
        {children}
        <SiteFooter showGroups={showGroups} />
        {user && <ChatBubble unread={unreadChat} />}
      </body>
    </html>
  );
}
