/**
 * GET    /api/products/:id  — detalhe do anuncio (com split).
 * PATCH  /api/products/:id  — edita (apenas dono; RLS garante).
 * DELETE /api/products/:id  — exclusao logica (status = excluido).
 */
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { ok, fail, handleError, readJson } from "@/lib/http";
import { updateProductSchema } from "@/lib/validation";
import { toCents, percentToBps } from "@/lib/money";

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

    const patch: Record<string, unknown> = {};
    if (body.title !== undefined) patch.title = body.title;
    if (body.description !== undefined) patch.description = body.description;
    if (body.images !== undefined) patch.images = body.images;
    if (body.amount_total !== undefined) patch.amount_total_cents = toCents(body.amount_total);
    if (body.commission_percent !== undefined)
      patch.commission_bps = percentToBps(body.commission_percent);
    if (body.status !== undefined) patch.status = body.status;

    // RLS so permite o dono atualizar. update sem linha retorna vazio.
    const { data, error } = await supabase
      .from("products")
      .update(patch)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return fail("Anuncio nao encontrado ou sem permissao", 404);
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
