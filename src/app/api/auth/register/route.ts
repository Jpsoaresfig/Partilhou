/**
 * POST /api/auth/register
 * Cria a conta via Supabase Auth. A trigger app.handle_new_user() cria o profile,
 * os dados privados (documento/telefone) e a carteira automaticamente.
 */
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ok, fail, handleError, readJson } from "@/lib/http";
import { registerSchema } from "@/lib/validation";
import { translateRegisterError } from "@/lib/authErrors";

export async function POST(req: Request) {
  try {
    const body = registerSchema.parse(await readJson(req));
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.auth.signUp({
      email: body.email,
      password: body.password,
      options: {
        data: {
          full_name: body.full_name,
          document_number: body.document_number ?? null,
          phone: body.phone ?? null,
          // Declaracao de maioridade (gate de venda) e aceite dos termos.
          is_adult: true,
          terms_accepted_at: new Date().toISOString(),
        },
      },
    });

    if (error) {
      // Traduz o erro do Supabase (ingles) para uma mensagem clara em pt-BR.
      const { message, status } = translateRegisterError(error);
      return fail(message, status);
    }

    return ok(
      {
        user_id: data.user?.id ?? null,
        // Quando a confirmacao por e-mail esta ligada, session vem nula.
        needs_email_confirmation: !data.session,
      },
      201,
    );
  } catch (err) {
    return handleError(err);
  }
}
