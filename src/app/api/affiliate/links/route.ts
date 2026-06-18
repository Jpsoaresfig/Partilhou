/**
 * POST /api/affiliate/links  — gera (ou reaproveita) o link de afiliado.
 * GET  /api/affiliate/links  — lista os links do afiliado autenticado.
 */
import { requireUser } from "@/lib/auth";
import { appRpc } from "@/lib/supabase/admin";
import { ok, handleError, readJson } from "@/lib/http";
import { createAffiliateLinkSchema } from "@/lib/validation";
import { toCents } from "@/lib/money";
import { serverEnv } from "@/lib/env";

export async function POST(req: Request) {
  try {
    const { user } = await requireUser();
    const body = createAffiliateLinkSchema.parse(await readJson(req));

    // Com preco escolhido: cria/atualiza o link gravando o preco (valida a faixa).
    // Sem preco: apenas gera/reaproveita o link (preserva preco ja definido).
    // Ambas SECURITY DEFINER validam: produto ativo e afiliado != vendedor.
    const rpc = appRpc();
    const { data, error } =
      body.sale_price !== undefined
        ? await rpc.rpc("set_affiliate_sale_price", {
            p_affiliate_id: user.id,
            p_product_id: body.product_id,
            p_sale_price: toCents(body.sale_price),
          })
        : await rpc.rpc("create_affiliate_link", {
            p_affiliate_id: user.id,
            p_product_id: body.product_id,
          });

    if (error) throw error;

    const code = data.tracking_code as string;
    return ok(
      {
        link: data,
        share_url: `${serverEnv.appUrl}/produto/${body.product_id}?ref=${code}`,
      },
      201,
    );
  } catch (err) {
    return handleError(err);
  }
}

export async function GET() {
  try {
    const { user, supabase } = await requireUser();
    const { data, error } = await supabase
      .from("affiliate_links")
      .select("*")
      .eq("affiliate_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return ok({ links: data });
  } catch (err) {
    return handleError(err);
  }
}
