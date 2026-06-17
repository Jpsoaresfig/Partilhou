/**
 * Factory do provedor de pagamento ativo, definido por PAYMENT_PROVIDER.
 */
import { serverEnv } from "@/lib/env";
import type { PaymentProvider } from "./types";
import { MercadoPagoProvider } from "./mercadopago";
import { MockProvider } from "./mock";

let instance: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (instance) return instance;
  switch (serverEnv.paymentProvider) {
    case "mercadopago":
      instance = new MercadoPagoProvider();
      break;
    case "mock":
    default:
      instance = new MockProvider();
      break;
  }
  return instance;
}

export * from "./types";
