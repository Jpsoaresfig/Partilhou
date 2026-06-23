/**
 * POST /api/products/validate  — (re)calcula a confianca de um anuncio.
 *
 * Recalcula trust_score + verification_status a partir dos DADOS JA GRAVADOS do
 * produto (fotos, descricao/atributos, IMEI) — nunca de input do cliente, para
 * o vendedor nao "escolher" o proprio selo. Pode ser chamado pelo DONO do
 * anuncio (apos editar) ou por um admin. Nao bloqueia, nao despublica e respeita
 * decisoes humanas de moderacao (ver app.classify_product).
 *
 * Body: { product_id: uuid }
 */
import { requireUser } from "@/lib/auth";
import { createSupabaseAdminClient, appRpc } from "@/lib/supabase/admin";
import { ok, fail, handleError, readJson } from "@/lib/http";
import { calculateTrustScore } from "@/lib/trust";
import { z } from "zod";

const schema = z.object({ product_id: z.string().uuid() });

export async function POST(req: Request) {
  try {
    const { user } = await requireUser();
    const { product_id } = schema.parse(await readJson(req));
    const isAdmin = user.app_metadata?.is_admin === true;

    // Le os dados gravados com service role (bypassa RLS); a autorizacao
    // (dono ou admin) e checada explicitamente abaixo.
    const admin = createSupabaseAdminClient();
    const { data: product, error } = await admin
      .from("products")
      .select("id, seller_id, images, description, imei, category, attributes, review_status, reviewed_by")
      .eq("id", product_id)
      .single();

    if (error || !product) return fail("Produto nao encontrado", 404);
    if (!isAdmin && product.seller_id !== user.id) {
      return fail("Voce nao pode validar este anuncio", 403);
    }

    const trust = calculateTrustScore({
      images: product.images,
      description: product.description,
      imei: product.imei,
      category: product.category,
      attributes: product.attributes,
    });

    const rpc = appRpc();
    const { data: classified, error: classifyError } = await rpc.rpc("classify_product", {
      p_product_id: product_id,
      p_status: trust.status,
      p_trust_score: trust.score,
    });
    if (classifyError) throw classifyError;

    // classify_product devolve a linha intacta se ja houve decisao humana ou
    // rejeicao — sinaliza isso para a UI nao prometer mudanca que nao houve.
    const respected =
      product.reviewed_by != null || product.review_status === "rejected";

    return ok({ product: classified, trust, applied: !respected });
  } catch (err) {
    return handleError(err);
  }
}
