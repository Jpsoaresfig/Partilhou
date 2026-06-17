/**
 * GET /api/dev/mock-pay?payment_id=mock_<orderId>
 * APENAS para desenvolvimento (PAYMENT_PROVIDER=mock). Simula a aprovacao do
 * pagamento exercitando a MESMA funcao idempotente usada pelo webhook real.
 */
import { NextResponse } from "next/server";
import { appRpc } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";

export async function GET(req: Request) {
  if (serverEnv.paymentProvider !== "mock") {
    return new Response("disponivel apenas no modo mock", { status: 403 });
  }

  const paymentId = new URL(req.url).searchParams.get("payment_id") ?? "";
  const orderId = paymentId.replace(/^mock_/, "");
  if (!orderId) return new Response("payment_id ausente", { status: 400 });

  const { error } = await appRpc().rpc("confirm_payment", {
    p_order_id: orderId,
    p_provider: "mock",
    p_provider_payment_id: paymentId,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.redirect(new URL(`/pedidos/${orderId}`, serverEnv.appUrl));
}
