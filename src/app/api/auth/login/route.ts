/**
 * POST /api/auth/login
 * Autentica via Supabase Auth. A sessao (access token de 15 min + refresh token
 * rotativo) e salva em cookies HTTP-only pelo @supabase/ssr.
 */
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ok, fail, handleError, readJson } from "@/lib/http";
import { loginSchema } from "@/lib/validation";
import { translateLoginError } from "@/lib/authErrors";

export async function POST(req: Request) {
  try {
    const body = loginSchema.parse(await readJson(req));
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });

    if (error) {
      const { message, status } = translateLoginError(error);
      return fail(message, status);
    }

    return ok({ user_id: data.user.id, email: data.user.email });
  } catch (err) {
    return handleError(err);
  }
}
