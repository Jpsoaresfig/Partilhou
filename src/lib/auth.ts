/**
 * Helpers de autenticacao/autorizacao para as route handlers.
 */
import { createSupabaseServerClient } from "@/lib/supabase/server";

export class AuthError extends Error {
  code = "insufficient_privilege";
  constructor(message = "Nao autenticado") {
    super(message);
  }
}

/** Retorna o usuario autenticado ou lanca AuthError (401/403). */
export async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AuthError();
  }
  return { user, supabase };
}

/** Exige que o usuario seja admin (flag em app_metadata, nao editavel pelo user). */
export async function requireAdmin() {
  const { user, supabase } = await requireUser();
  const isAdmin = user.app_metadata?.is_admin === true;
  if (!isAdmin) {
    throw new AuthError("Acesso restrito a administradores");
  }
  return { user, supabase };
}
