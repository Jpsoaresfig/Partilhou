/**
 * POST /api/checkout
 * 1) Cria o Pedido (app.create_order) com os valores do split congelados.
 * 2) Gera a cobranca no gateway (Escrow: a plataforma e a recebedora).
 * 3) Retorna a URL de checkout para o comprador pagar.
 *
 * O dinheiro NAO se move aqui. O credito nas carteiras (saldo_pendente) so
 * ocorre quando o webhook confirma o pagamento (app.confirm_payment).
 */
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { appRpc, createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ok, fail, handleError, readJson } from "@/lib/http";
import { checkoutSchema } from "@/lib/validation";
import { getPaymentProvider } from "@/lib/payments";
import { serverEnv } from "@/lib/env";

export async function POST(req: Request) {
  try {
    const { user } = await requireUser();
    const body = checkoutSchema.parse(await readJson(req));

    // Atribuicao: prioridade ao codigo explicito; senao usa o cookie de last-click.
    const cookieStore = await cookies();
    const affiliateCode = body.affiliate_code ?? cookieStore.get("partilhou_ref")?.value ?? null;

    const rpc = appRpc();

    // 1) Cria o pedido (atomico, com snapshot e validacoes de negocio).
    //    O endereco de entrega e congelado no pedido (snapshot).
    const { data: order, error: orderErr } = await rpc.rpc("create_order", {
      p_buyer_id: user.id,
      p_product_id: body.product_id,
      p_affiliate_code: affiliateCode,
      p_shipping: body.shipping,
    });
    if (orderErr) throw orderErr;
    if (!order) return fail("Falha ao criar pedido", 400);

    // 2) Cria a cobranca no gateway (idempotente pelo id do pedido).
    const provider = getPaymentProvider();
    const charge = await provider.createCharge({
      orderId: order.id,
      amountCents: order.amount_total_cents,
      description: `Pedido ${order.id}`,
      payerEmail: body.payer_email ?? user.email ?? undefined,
      successUrl: `${serverEnv.appUrl}/pedidos/${order.id}`,
      failureUrl: `${serverEnv.appUrl}/pedidos/${order.id}?status=falha`,
      idempotencyKey: `order-${order.id}`,
    });

    // 3) Guarda a referencia do gateway no pedido (admin: bypassa RLS de write).
    const admin = createSupabaseAdminClient();
    await admin
      .from("orders")
      .update({
        payment_provider: provider.name,
        provider_payment_id: charge.providerPaymentId,
      })
      .eq("id", order.id);

    return ok(
      {
        order_id: order.id,
        amount_total_cents: order.amount_total_cents,
        checkout_url: charge.checkoutUrl,
      },
      201,
    );
  } catch (err) {
    return handleError(err);
  }
}
