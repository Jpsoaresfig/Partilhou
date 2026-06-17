/**
 * Cliente Supabase para o navegador (Client Components). Usa apenas a anon key
 * publica. Operacoes respeitam RLS.
 */
import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

export function createSupabaseBrowserClient() {
  return createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
}
