/**
 * GET  /api/products        — lista anuncios ativos (com simulacao de split).
 * POST /api/products        — cria anuncio (vendedor autenticado).
 */
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError, readJson } from "@/lib/http";
import { createProductSchema } from "@/lib/validation";
import { productPricingColumns } from "@/lib/products";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 24), 100);
    const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("products_with_split")
      .select("*")
      .eq("status", "ativo")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return ok({ products: data, limit, offset });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const { user, supabase } = await requireUser();
    const body = createProductSchema.parse(await readJson(req));

    const { data, error } = await supabase
      .from("products")
      .insert({
        seller_id: user.id,
        title: body.title,
        description: body.description,
        images: body.images,
        category: body.category,
        attributes: body.attributes,
        ...productPricingColumns(body),
      })
      .select()
      .single();

    if (error) throw error;
    return ok({ product: data }, 201);
  } catch (err) {
    return handleError(err);
  }
}
