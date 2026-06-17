/**
 * GET /api/r/:code — entrada do link de afiliado.
 * Registra o clique, grava o cookie de atribuicao (validade configuravel) e
 * redireciona o comprador para a pagina do produto. O cookie e lido depois no
 * checkout para creditar a comissao ao afiliado correto.
 */
import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { appRpc } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";

function hashIp(ip: string): string {
  return createHmac("sha256", serverEnv.affiliateHashSecret).update(ip).digest("hex");
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const rpc = appRpc();

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "0.0.0.0";

  const { data, error } = await rpc.rpc("register_affiliate_click", {
    p_tracking_code: code,
    p_ip_hash: hashIp(ip),
    p_user_agent: req.headers.get("user-agent") ?? null,
  });

  // Codigo invalido: manda para a home sem cookie.
  if (error || !data) {
    return NextResponse.redirect(new URL("/", serverEnv.appUrl));
  }

  const productId = data.product_id as string;
  const cookieDaysSetting = 30; // espelha platform_settings.affiliate_cookie_days
  const res = NextResponse.redirect(
    new URL(`/produto/${productId}?ref=${code}`, serverEnv.appUrl),
  );

  // Cookie de atribuicao (last-click). Lido no checkout.
  res.cookies.set("partilhou_ref", code, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: cookieDaysSetting * 24 * 60 * 60,
    path: "/",
  });

  return res;
}
