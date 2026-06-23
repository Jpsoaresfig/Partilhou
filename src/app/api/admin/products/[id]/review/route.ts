/**
 * POST /api/admin/products/:id/review  — decisao de moderacao de um anuncio.
 *
 * Restrito a admins. Move o produto entre pending_review -> approved|partial|rejected
 * e grava o score de confianca. A escrita roda pela funcao app.review_product
 * (SECURITY DEFINER); a autorizacao de admin e feita aqui.
 */
import { requireAdmin } from "@/lib/auth";
import { appRpc } from "@/lib/supabase/admin";
import { ok, fail, handleError, readJson } from "@/lib/http";
import { z } from "zod";

const schema = z.object({
  decision: z.enum(["approved", "partial", "unverified", "rejected"]),
  trust_score: z.number().int().min(0).max(100).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireAdmin();
    const { id } = await params;
    const body = schema.parse(await readJson(req));

    // Score padrao por decisao quando o admin nao informa um valor explicito.
    const score =
      body.trust_score ??
      (body.decision === "approved" ? 80 : body.decision === "partial" ? 50 : 0);

    const rpc = appRpc();
    const { data, error } = await rpc.rpc("review_product", {
      p_product_id: id,
      p_decision: body.decision,
      p_trust_score: score,
      p_notes: body.notes ?? null,
      p_reviewer: user.id,
    });

    if (error) throw error;
    if (!data) return fail("Produto nao encontrado", 404);
    return ok({ product: data });
  } catch (err) {
    return handleError(err);
  }
}
