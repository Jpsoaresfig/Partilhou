/**
 * GET    /api/products/:id  — detalhe do anuncio (com split).
 * PATCH  /api/products/:id  — edita (apenas dono; RLS garante).
 * DELETE /api/products/:id  — exclusao logica (status = excluido).
 */
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { appRpc } from "@/lib/supabase/admin";
import { ok, fail, handleError, readJson } from "@/lib/http";
import { updateProductSchema } from "@/lib/validation";
import { productPricingColumns } from "@/lib/products";
import { calculateTrustScore } from "@/lib/trust";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("products_with_split")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return fail("Anuncio nao encontrado", 404);
    return ok({ product: data });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase } = await requireUser();
    const body = updateProductSchema.parse(await readJson(req));

    const patch: Record<string, unknown> = { ...productPricingColumns(body) };
    if (body.title !== undefined) patch.title = body.title;
    if (body.description !== undefined) patch.description = body.description;
    if (body.images !== undefined) patch.images = body.images;
    if (body.status !== undefined) patch.status = body.status;
    if (body.category !== undefined) patch.category = body.category;
    if (body.attributes !== undefined) patch.attributes = body.attributes;

    // RLS so permite o dono atualizar. update sem linha retorna vazio.
    const { data, error } = await supabase
      .from("products")
      .update(patch)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return fail("Anuncio nao encontrado ou sem permissao", 404);

    // Re-classifica a confianca a partir dos dados ATUALIZADOS (nao bloqueante;
    // classify_product respeita decisoes de moderacao do admin). Falha aqui nao
    // invalida a edicao.
    try {
      const trust = calculateTrustScore({
        images: data.images,
        description: data.description,
        imei: data.imei,
        category: data.category,
        attributes: data.attributes,
      });
      await appRpc().rpc("classify_product", {
        p_product_id: id,
        p_status: trust.status,
        p_trust_score: trust.score,
      });
    } catch (e) {
      console.error("[products PATCH] reclassificacao falhou:", e);
    }

    return ok({ product: data });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase } = await requireUser();
    // Exclusao logica para preservar historico de pedidos que referenciam o produto.
    const { data, error } = await supabase
      .from("products")
      .update({ status: "excluido" })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) return fail("Anuncio nao encontrado ou sem permissao", 404);
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
