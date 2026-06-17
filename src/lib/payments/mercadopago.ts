/**
 * Implementacao Mercado Pago (Checkout Pro) do PaymentProvider.
 *
 * Fluxo: criamos uma "preference" com external_reference = orderId. O comprador
 * paga no init_point. O Mercado Pago notifica nosso webhook; validamos a
 * assinatura (x-signature HMAC-SHA256) e consultamos /v1/payments/{id} para o
 * status autoritativo (nunca confiamos apenas no payload).
 *
 * Docs: https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/landing
 *       https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";
import type {
  PaymentProvider,
  CreateChargeInput,
  CreateChargeResult,
  VerifiedWebhook,
  PaymentInfo,
  ChargeStatus,
} from "./types";

const API = "https://api.mercadopago.com";

function mapStatus(s: string): ChargeStatus {
  switch (s) {
    case "approved":
      return "aprovado";
    case "rejected":
    case "cancelled":
      return "recusado";
    case "refunded":
    case "charged_back":
      return "estornado";
    default:
      return "pendente";
  }
}

export class MercadoPagoProvider implements PaymentProvider {
  readonly name = "mercadopago";

  private get token() {
    return serverEnv.mercadoPagoAccessToken;
  }

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    const body = {
      items: [
        {
          id: input.orderId,
          title: input.description.slice(0, 250),
          quantity: 1,
          currency_id: "BRL",
          unit_price: input.amountCents / 100,
        },
      ],
      // Amarra a preferencia ao nosso pedido. Volta no webhook/payment.
      external_reference: input.orderId,
      payer: input.payerEmail ? { email: input.payerEmail } : undefined,
      back_urls: { success: input.successUrl, failure: input.failureUrl, pending: input.successUrl },
      auto_return: "approved",
      // Evita estado "pendente" em cartao (aprovacao sincrona).
      binary_mode: true,
      notification_url: `${serverEnv.appUrl}/api/webhooks/mercadopago`,
    };

    const res = await fetch(`${API}/checkout/preferences`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        // Idempotencia no gateway: nao duplica preferencia para o mesmo pedido.
        "X-Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Mercado Pago createCharge falhou (${res.status}): ${txt}`);
    }
    const json = (await res.json()) as { id: string; init_point: string };
    return {
      providerPaymentId: json.id,
      checkoutUrl: json.init_point,
      status: "pendente",
    };
  }

  verifyWebhook(headers: Headers, rawBody: string): VerifiedWebhook {
    const signature = headers.get("x-signature") ?? "";
    const requestId = headers.get("x-request-id") ?? "";

    // x-signature => "ts=...,v1=..."
    const parts = Object.fromEntries(
      signature.split(",").map((kv) => {
        const [k, v] = kv.split("=");
        return [k?.trim(), v?.trim()];
      }),
    ) as { ts?: string; v1?: string };

    let payload: { data?: { id?: string }; type?: string; action?: string } = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      /* corpo pode vir vazio com data.id na query — tratado na rota */
    }
    const dataId = payload?.data?.id ? String(payload.data.id) : "";

    // Manifesto oficial do Mercado Pago.
    const manifest = `id:${dataId};request-id:${requestId};ts:${parts.ts};`;
    const expected = createHmac("sha256", serverEnv.mercadoPagoWebhookSecret)
      .update(manifest)
      .digest("hex");

    const valid =
      !!parts.v1 &&
      parts.v1.length === expected.length &&
      timingSafeEqual(Buffer.from(parts.v1), Buffer.from(expected));

    return {
      valid,
      // Idempotencia: o id do recurso + request-id formam um identificador estavel.
      eventId: `${dataId}:${requestId}`,
      eventType: payload?.type ?? payload?.action ?? "payment",
      resourceId: dataId,
    };
  }

  async getPayment(providerPaymentId: string): Promise<PaymentInfo> {
    const res = await fetch(`${API}/v1/payments/${providerPaymentId}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!res.ok) {
      throw new Error(`Mercado Pago getPayment falhou (${res.status})`);
    }
    const json = (await res.json()) as {
      id: number;
      status: string;
      external_reference?: string;
      transaction_amount?: number;
    };
    return {
      providerPaymentId: String(json.id),
      status: mapStatus(json.status),
      orderId: json.external_reference ?? null,
      amountCents:
        typeof json.transaction_amount === "number"
          ? Math.round(json.transaction_amount * 100)
          : null,
    };
  }
}
