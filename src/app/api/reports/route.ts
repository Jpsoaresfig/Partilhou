/**
 * POST /api/reports
 * Recebe um "reportar problema" do formulario /reportar. Funciona logado ou
 * anonimo. A escrita usa o cliente admin (service_role) porque a tabela
 * problem_reports nao concede grants ao cliente.
 */
import { getServerUser } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ok, handleError, readJson } from "@/lib/http";
import { reportSchema } from "@/lib/validation";

export async function POST(req: Request) {
  try {
    const body = reportSchema.parse(await readJson(req));
    const { user } = await getServerUser();

    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("problem_reports").insert({
      user_id: user?.id ?? null,
      // Para logados, usa o e-mail da conta; senao, o informado no formulario.
      email: user?.email ?? body.email ?? null,
      category: body.category,
      message: body.message,
      url: body.url ?? null,
    });

    if (error) throw error;
    return ok({ received: true }, 201);
  } catch (err) {
    return handleError(err);
  }
}
