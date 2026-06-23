/**
 * POST /api/orders/:id/rate  { role: "vendedor"|"afiliado", score: 1..5, comment? }
 * O comprador avalia o vendedor (e/ou o afiliado) de um pedido concluido.
 */
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { appRpc } from "@/lib/supabase/admin";
import { ok, handleError, readJson } from "@/lib/http";

const rateSchema = z.object({
  role: z.enum(["vendedor", "afiliado", "comprador"]),
  score: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireUser();
    const { id } = await params;
    const body = rateSchema.parse(await readJson(req));

    const { data, error } = await appRpc().rpc("rate_order", {
      p_order_id: id,
      p_actor_id: user.id,
      p_role: body.role,
      p_score: body.score,
      p_comment: body.comment ?? null,
    });
    if (error) throw error;
    return ok({ rating: data }, 201);
  } catch (err) {
    return handleError(err);
  }
}
