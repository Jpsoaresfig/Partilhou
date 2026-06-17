/**
 * POST /api/auth/logout — encerra a sessao e limpa os cookies.
 */
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ok, handleError } from "@/lib/http";

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    return ok({ signed_out: true });
  } catch (err) {
    return handleError(err);
  }
}
