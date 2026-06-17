/**
 * POST /api/orders/:id/dispute
 * Comprador abre disputa (nao recebeu / com defeito). Congela os fundos no
 * saldo_pendente e impede a liberacao automatica ate a mediacao decidir.
 */
import { requireUser } from "@/lib/auth";
import { appRpc } from "@/lib/supabase/admin";
import { ok, handleError, readJson } from "@/lib/http";
import { disputeSchema } from "@/lib/validation";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { user } = await requireUser();
    const body = disputeSchema.parse(await readJson(req));

    const { data, error } = await appRpc().rpc("open_dispute", {
      p_order_id: id,
      p_actor_id: user.id,
      p_reason: body.reason,
    });
    if (error) throw error;
    return ok({ order: data });
  } catch (err) {
    return handleError(err);
  }
}
