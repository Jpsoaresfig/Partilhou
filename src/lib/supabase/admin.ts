/**
 * Cliente Supabase com service_role. FAZ BYPASS DE RLS.
 *
 * Use SOMENTE no servidor e SOMENTE para:
 *   - chamar funcoes financeiras do schema `app` (RPC),
 *   - processar webhooks,
 *   - operacoes administrativas.
 *
 * Nunca importe este modulo em codigo de cliente. A chave nunca tem prefixo
 * NEXT_PUBLIC_, entao o bundler do Next falharia ao tentar inclui-la no browser.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

let cached: SupabaseClient | null = null;

export function createSupabaseAdminClient(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(serverEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: { schema: "public" },
  });
  return cached;
}

/**
 * Cliente admin apontando para o schema privado `app`, onde vivem as funcoes
 * financeiras SECURITY DEFINER. Necessario porque o schema `app` nao e exposto
 * via Data API publica.
 */
export function appRpc() {
  return createClient(serverEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: "app" },
  });
}
