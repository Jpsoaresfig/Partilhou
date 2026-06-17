/**
 * Cliente Supabase para o servidor (Route Handlers / Server Components).
 * Usa @supabase/ssr para ler/gravar a sessao em cookies HTTP-only. As operacoes
 * feitas com este cliente RESPEITAM a RLS (rodam como o usuario logado).
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { serverEnv } from "@/lib/env";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(serverEnv.supabaseUrl, serverEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Chamado a partir de um Server Component sem resposta mutavel.
          // O middleware cuida da renovacao da sessao nesse caso.
        }
      },
    },
  });
}
