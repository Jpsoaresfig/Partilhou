/**
 * Contrato do provedor de pagamento. Abstrai o gateway para que o nucleo de
 * escrow nao dependa de Mercado Pago/Stripe/etc. Trocar de gateway = trocar a
 * implementacao, sem mexer nas regras de negocio.
 *
 * Arquitetura de escrow: a PLATAFORMA e a unica recebedora (collector). Todo o
 * valor entra na conta da plataforma e e retido no ledger interno. Os repasses
 * a vendedor/afiliado acontecem depois, via payout (saque), e nao por split
 * imediato no gateway. Isso e o que viabiliza o "pagamento cautelar".
 */

export type ChargeStatus = "pendente" | "aprovado" | "recusado" | "estornado";

export interface CreateChargeInput {
  orderId: string;
  amountCents: number;
  description: string;
  payerEmail?: string;
  /** URL de retorno apos o checkout. */
  successUrl: string;
  failureUrl: string;
  /** Chave de idempotencia para nao criar cobranca duplicada. */
  idempotencyKey: string;
}

export interface CreateChargeResult {
  providerPaymentId: string;
  /** URL para redirecionar o comprador (Checkout Pro / link de pagamento). */
  checkoutUrl: string;
  status: ChargeStatus;
}

export interface VerifiedWebhook {
  valid: boolean;
  /** Id unico do evento para idempotencia (provider + eventId). */
  eventId: string;
  eventType: string;
  /** Id do recurso (payment) no gateway. */
  resourceId: string;
}

export interface PaymentInfo {
  providerPaymentId: string;
  status: ChargeStatus;
  /** external_reference que amarramos ao nosso orderId. */
  orderId: string | null;
  amountCents: number | null;
}

export interface PaymentProvider {
  readonly name: string;

  /** Cria a cobranca/preferencia e retorna a URL de checkout. */
  createCharge(input: CreateChargeInput): Promise<CreateChargeResult>;

  /**
   * Valida a assinatura do webhook a partir dos headers + corpo bruto.
   * Retorna o evento normalizado. NUNCA confie no payload sem validar.
   */
  verifyWebhook(headers: Headers, rawBody: string): VerifiedWebhook;

  /** Consulta autoritativa do status do pagamento no gateway. */
  getPayment(providerPaymentId: string): Promise<PaymentInfo>;
}
