/**
 * POST /api/orders/:id/ship — vendedor informa envio/rastreio.
 * Inicia a contagem do escrow (liberacao automatica apos X dias).
 */
import { requireUser } from "@/lib/auth";
import { appRpc } from "@/lib/supabase/admin";
import { ok, handleError, readJson } from "@/lib/http";
import { shipSchema } from "@/lib/validation";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { user } = await requireUser();
    const body = shipSchema.parse(await readJson(req));

    // A funcao valida que o ator e o vendedor do pedido.
    const { data, error } = await appRpc().rpc("mark_shipped", {
      p_order_id: id,
      p_actor_id: user.id,
      p_tracking_code: body.tracking_code ?? null,
    });
    if (error) throw error;
    return ok({ order: data });
  } catch (err) {
    return handleError(err);
  }
}
