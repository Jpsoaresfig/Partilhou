import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Fixa a raiz no projeto (ha um package-lock.json no diretorio pai que
  // confundia a deteccao automatica e quebrava o output tracing).
  outputFileTracingRoot: process.cwd(),
  // O webhook do Mercado Pago precisa do corpo bruto (raw body) para validar a
  // assinatura. As rotas de webhook leem o body manualmente, entao nao habilitamos
  // parsers globais aqui. Mantemos a config minima e segura.
  poweredByHeader: false,
  // Mantem pacotes server-only fora do bundle do cliente (renomeado no Next 15).
  serverExternalPackages: ["@supabase/supabase-js"],
};

export default nextConfig;
