import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { getServerUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Partilhou — Marketplace C2C com afiliacao",
  description:
    "Compre, venda e indique produtos usados com pagamento garantido (escrow).",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f1115",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { supabase, user } = await getServerUser();

  let unread = 0;
  if (user) {
    // Presenca ("online", limitada a 1 escrita/min pelo banco) e contagem de nao
    // lidas sao independentes — disparam em paralelo em vez de em serie.
    const [, { count }] = await Promise.all([
      supabase.rpc("touch_presence"),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null),
    ]);
    unread = count ?? 0;
  }

  return (
    <html lang="pt-BR">
      <body>
        <Navbar
          authed={!!user}
          isAdmin={user?.app_metadata?.is_admin === true}
          unread={unread}
        />
        {children}
      </body>
    </html>
  );
}
