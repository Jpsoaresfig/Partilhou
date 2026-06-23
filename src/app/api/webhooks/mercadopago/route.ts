/**
 * POST /api/webhooks/mercadopago
 *
 * Recebe notificacoes do gateway. SEGURANCA E IDEMPOTENCIA:
 *   1) Valida a assinatura (HMAC) com o corpo BRUTO. Invalido => 401.
 *   2) Registra o evento (provider, event_id) — unico. Reentrega ja PROCESSADA
 *      e respondida com 200 sem reprocessar.
 *   3) Consulta o status AUTORITATIVO no gateway (getPayment). Nunca confia
 *      apenas no payload recebido.
 *   4) Aplica a transicao via funcao idempotente (confirm_payment/refund_order):
 *      mesmo que tudo acima falhe, o guard de funds_state impede credito duplo.
 *   5) Falha de processamento => 500, para o gateway reentregar.
 */
import { appRpc, createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPaymentProvider } from "@/lib/payments";

export async function POST(req: Request) {
  const provider = getPaymentProvider();
  const rawBody = await req.text();

  // 1) Validacao de assinatura.
  const verified = provider.verifyWebhook(req.headers, rawBody);
  if (!verified.valid) {
    return new Response("assinatura invalida", { status: 401 });
  }

  // Resolve o id do recurso (pode vir na query em notificacoes antigas).
  const url = new URL(req.url);
  const resourceId =
    verified.resourceId || url.searchParams.get("data.id") || url.searchParams.get("id") || "";
  if (!resourceId) {
    return new Response("ok (sem recurso)", { status: 200 });
  }

  const admin = createSupabaseAdminClient();
  const rpc = appRpc();

  let payload: unknown = {};
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    /* ignore */
  }

  // 2) Registro idempotente do evento.
  const { data: isNew, error: recErr } = await rpc.rpc("record_payment_event", {
    p_provider: provider.name,
    p_event_id: verified.eventId,
    p_event_type: verified.eventType,
    p_resource_id: resourceId,
    p_payload: payload,
  });
  if (recErr) {
    console.error("[webhook] erro ao registrar evento:", recErr);
    return new Response("erro", { status: 500 });
  }

  if (!isNew) {
    // Ja visto. Se ja foi processado, encerra. Senao, segue para retentar.
    const { data: existing } = await admin
      .from("payment_events")
      .select("status")
      .eq("provider", provider.name)
      .eq("event_id", verified.eventId)
      .maybeSingle();
    if (existing?.status === "processado" || existing?.status === "ignorado") {
      return new Response("ok (duplicado)", { status: 200 });
    }
  }

  try {
    // 3) Status autoritativo no gateway.
    const info = await provider.getPayment(resourceId);
    const orderId = info.orderId;
    let resultStatus = "ignorado";

    if (orderId) {
      // 4) Transicao idempotente conforme o status.
      if (info.status === "aprovado") {
        // Defesa: confere o valor pago contra o total do pedido. Se divergir,
        // NAO confirma (evita liberar split com valor errado) e marca p/ revisao.
        let amountOk = true;
        if (info.amountCents != null) {
          const { data: ord } = await admin
            .from("orders")
            .select("amount_total_cents")
            .eq("id", orderId)
            .maybeSingle();
          amountOk = !!ord && ord.amount_total_cents === info.amountCents;
        }
        if (!amountOk) {
          console.error(
            `[webhook] valor divergente no pedido ${orderId}: pago=${info.amountCents}`,
          );
          resultStatus = "ignorado";
        } else {
          const { error } = await rpc.rpc("confirm_payment", {
            p_order_id: orderId,
            p_provider: provider.name,
            p_provider_payment_id: info.providerPaymentId,
          });
          if (error) throw error;
          resultStatus = "processado";
        }
      } else if (info.status === "estornado") {
        const { error } = await rpc.rpc("refund_order", { p_order_id: orderId });
        if (error) throw error;
        resultStatus = "processado";
      }
    }

    await admin
      .from("payment_events")
      .update({
        status: resultStatus,
        order_id: orderId,
        processed_at: new Date().toISOString(),
      })
      .eq("provider", provider.name)
      .eq("event_id", verified.eventId);

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("[webhook] erro ao processar:", err);
    await admin
      .from("payment_events")
      .update({ status: "erro", error: String(err).slice(0, 1000) })
      .eq("provider", provider.name)
      .eq("event_id", verified.eventId);
    // 500 => o gateway reentrega; o guard de estado evita efeito duplicado.
    return new Response("erro ao processar", { status: 500 });
  }
}
