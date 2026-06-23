/**
 * POST   /api/grupos/:id/participar  — entra no grupo (vira membro).
 * DELETE /api/grupos/:id/participar  — sai do grupo.
 *
 * A RLS cuida das regras: so da pra entrar em grupo publico e como voce mesmo;
 * o papel cai sempre em 'membro' (o GRANT nao concede a coluna `role`). Os
 * contadores de membros sao mantidos por trigger.
 */
import { requireUser } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { groupsEnabled } from "@/lib/flags";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await groupsEnabled())) return fail("Area de Grupos indisponivel", 404);
    const { user, supabase } = await requireUser();
    const { id } = await params;

    const { error } = await supabase
      .from("group_members")
      .insert({ group_id: id, profile_id: user.id });

    if (error) throw error;
    return ok({ joined: true }, 201);
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, supabase } = await requireUser();
    const { id } = await params;

    const { error } = await supabase
      .from("group_members")
      .delete()
      .eq("group_id", id)
      .eq("profile_id", user.id);

    if (error) throw error;
    return ok({ left: true });
  } catch (err) {
    return handleError(err);
  }
}
