/**
 * Cliente Supabase para o servidor (Route Handlers / Server Components).
 * Usa @supabase/ssr para ler/gravar a sessao em cookies HTTP-only. As operacoes
 * feitas com este cliente RESPEITAM a RLS (rodam como o usuario logado).
 */
import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { serverEnv } from "@/lib/env";

/**
 * Cria (uma unica vez por request) o cliente Supabase do servidor.
 * `cache()` memoiza por request: layout, pagina e componentes filhos compartilham
 * a MESMA instancia em vez de reconstruir o cliente a cada chamada.
 */
export const createSupabaseServerClient = cache(async () => {
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
});

/**
 * Usuario autenticado do request atual, com validacao do token no servidor.
 *
 * `cache()` garante que o `getUser()` (round-trip de rede ao Auth) rode UMA vez
 * por request, mesmo que o layout, a pagina e varios helpers/componentes
 * precisem do usuario. Antes, cada um chamava `getUser()` por conta propria,
 * empilhando 2-3 round-trips por navegacao. Use este helper em vez de
 * `supabase.auth.getUser()` direto.
 */
export const getServerUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return { supabase, user, error };
});
