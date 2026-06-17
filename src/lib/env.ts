/**
 * Acesso centralizado e validado a variaveis de ambiente.
 *
 * Regra de seguranca: nada com prefixo NEXT_PUBLIC_ deve conter segredos.
 * Os getters do servidor (serverEnv) lancam erro se chamados sem o valor,
 * evitando que a app suba meio-configurada em producao.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(
      `Variavel de ambiente obrigatoria ausente: ${name}. Veja .env.example.`,
    );
  }
  return value;
}

/** Seguro para o cliente (browser). */
export const publicEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  mercadoPagoPublicKey: process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ?? "",
};

/** Apenas servidor. Acesso lazy para nao quebrar o build do cliente. */
export const serverEnv = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabaseAnonKey() {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  },
  get supabaseServiceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
  },
  get paymentProvider() {
    return (process.env.PAYMENT_PROVIDER ?? "mock").toLowerCase();
  },
  get mercadoPagoAccessToken() {
    return required("MERCADOPAGO_ACCESS_TOKEN", process.env.MERCADOPAGO_ACCESS_TOKEN);
  },
  get mercadoPagoWebhookSecret() {
    return required("MERCADOPAGO_WEBHOOK_SECRET", process.env.MERCADOPAGO_WEBHOOK_SECRET);
  },
  get affiliateHashSecret() {
    return required("AFFILIATE_HASH_SECRET", process.env.AFFILIATE_HASH_SECRET);
  },
  get appUrl() {
    return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  },
};
