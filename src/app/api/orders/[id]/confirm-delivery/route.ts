/**
 * POST /api/orders/:id/confirm-delivery
 * Comprador confirma "recebi e esta tudo ok" -> libera os fundos (split):
 * saldo_pendente -> saldo_disponivel para vendedor e afiliado.
 */
import { requireUser } from "@/lib/auth";
import { appRpc } from "@/lib/supabase/admin";
import { ok, handleError } from "@/lib/http";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { user } = await requireUser();

    const { data, error } = await appRpc().rpc("confirm_delivery", {
      p_order_id: id,
      p_actor_id: user.id,
    });
    if (error) throw error;
    return ok({ order: data });
  } catch (err) {
    return handleError(err);
  }
}
