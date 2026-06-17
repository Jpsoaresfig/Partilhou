/**
 * Provedor de pagamento MOCK para desenvolvimento e testes.
 * Simula um gateway: o checkout aponta para uma rota local que dispara o webhook
 * de aprovacao. Permite exercitar todo o fluxo de escrow sem credenciais reais.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";
import type {
  PaymentProvider,
  CreateChargeInput,
  CreateChargeResult,
  VerifiedWebhook,
  PaymentInfo,
} from "./types";

// Armazenamento em memoria do status (apenas dev). Em testes reais use o DB.
const store = new Map<string, { orderId: string; amountCents: number; status: string }>();

export class MockProvider implements PaymentProvider {
  readonly name = "mock";

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    const id = `mock_${input.orderId}`;
    store.set(id, { orderId: input.orderId, amountCents: input.amountCents, status: "approved" });
    // Pagina simulada que permite "aprovar" o pagamento manualmente em dev.
    const checkoutUrl = `${serverEnv.appUrl}/api/dev/mock-pay?payment_id=${id}`;
    return { providerPaymentId: id, checkoutUrl, status: "pendente" };
  }

  verifyWebhook(headers: Headers, rawBody: string): VerifiedWebhook {
    // No mock validamos um HMAC simples com o mesmo segredo, para exercitar o
    // caminho de verificacao de assinatura.
    const sig = headers.get("x-mock-signature") ?? "";
    const expected = createHmac("sha256", serverEnv.mercadoPagoWebhookSecret)
      .update(rawBody)
      .digest("hex");
    const valid =
      sig.length === expected.length &&
      timingSafeEqual(Buffer.from(sig || "x"), Buffer.from(expected));

    let payload: { data?: { id?: string }; type?: string } = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      /* ignore */
    }
    const id = payload?.data?.id ?? "";
    return { valid, eventId: id, eventType: payload?.type ?? "payment", resourceId: id };
  }

  async getPayment(providerPaymentId: string): Promise<PaymentInfo> {
    const rec = store.get(providerPaymentId);
    return {
      providerPaymentId,
      status: rec?.status === "approved" ? "aprovado" : "pendente",
      orderId: rec?.orderId ?? providerPaymentId.replace(/^mock_/, ""),
      amountCents: rec?.amountCents ?? null,
    };
  }
}
