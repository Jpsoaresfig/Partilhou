/**
 * GET  /api/products        — lista anuncios ativos (com simulacao de split),
 *                             rankeados por confianca (trust_score desc).
 * POST /api/products        — cria anuncio (vendedor autenticado) e ja aplica a
 *                             classificacao de confianca automatica (nao bloqueia).
 */
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { appRpc } from "@/lib/supabase/admin";
import { ok, handleError, readJson } from "@/lib/http";
import { createProductSchema } from "@/lib/validation";
import { productPricingColumns } from "@/lib/products";
import { calculateTrustScore } from "@/lib/trust";

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
      // Mostra todos os anuncios publicados, exceto os reprovados (golpe/dados
      // insuficientes). Nao-verificados aparecem — apenas com menos destaque.
      .in("review_status", ["approved", "partial", "unverified"])
      // Ranking de confianca: verificados (score alto) primeiro; empate por data.
      .order("trust_score", { ascending: false })
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
        imei: body.imei ?? null,
        ...productPricingColumns(body),
      })
      .select()
      .single();

    if (error) throw error;

    // Classificacao de confianca automatica e NAO bloqueante: o anuncio ja
    // nasce visivel, com selo/score derivados da completude dos dados. O calculo
    // usa os dados gravados (nao input bruto), e a escrita do status passa pela
    // funcao privilegiada (o usuario nao escolhe o proprio selo).
    const trust = calculateTrustScore({
      images: body.images,
      description: body.description,
      imei: typeof body.imei === "string" ? body.imei : null,
      category: body.category,
      attributes: body.attributes,
    });

    const rpc = appRpc();
    const { data: classified, error: classifyError } = await rpc.rpc("classify_product", {
      p_product_id: data.id as string,
      p_status: trust.status,
      p_trust_score: trust.score,
    });
    if (classifyError) throw classifyError;

    return ok({ product: classified ?? data, trust }, 201);
  } catch (err) {
    return handleError(err);
  }
}
