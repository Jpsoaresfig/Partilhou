/**
 * POST /api/notifications/read — marca notificacoes como lidas.
 * Corpo opcional { id }: marca apenas uma. Sem corpo: marca todas as nao lidas.
 * A RLS garante que so as proprias notificacoes do usuario sao afetadas.
 */
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";

export async function POST(req: Request) {
  try {
    const { user, supabase } = await requireUser();

    let id: string | undefined;
    try {
      const body = await req.json();
      if (body && typeof body.id === "string") id = body.id;
    } catch {
      /* sem corpo: marca todas */
    }

    let query = supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);

    if (id) query = query.eq("id", id);

    const { error } = await query;
    if (error) throw error;
    return ok({ marked: true });
  } catch (err) {
    return handleError(err);
  }
}
