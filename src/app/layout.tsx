import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Partilhou — Marketplace C2C com afiliacao",
  description:
    "Compre, venda e indique produtos usados com pagamento garantido (escrow).",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="pt-BR">
      <body>
        <Navbar authed={!!user} isAdmin={user?.app_metadata?.is_admin === true} />
        {children}
      </body>
    </html>
  );
}
