/**
 * POST /api/chat/start  { product_id }
 * O afiliado (ou qualquer interessado que nao seja o vendedor) abre — ou
 * reaproveita — a conversa com o vendedor de um anuncio. Idempotente pelo par
 * (produto, afiliado). Retorna a conversa para o cliente navegar ate /chat/:id.
 */
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { appRpc } from "@/lib/supabase/admin";
import { ok, handleError, readJson } from "@/lib/http";

const startSchema = z.object({
  product_id: z.string().uuid(),
});

export async function POST(req: Request) {
  try {
    const { user } = await requireUser();
    const body = startSchema.parse(await readJson(req));

    const { data, error } = await appRpc().rpc("start_conversation", {
      p_actor_id: user.id,
      p_product_id: body.product_id,
    });
    if (error) throw error;
    return ok({ conversation: data }, 201);
  } catch (err) {
    return handleError(err);
  }
}
