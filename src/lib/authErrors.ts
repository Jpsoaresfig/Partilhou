/**
 * Traduz erros do Supabase Auth (GoTrue) para mensagens claras em pt-BR.
 *
 * O Supabase devolve mensagens em ingles e, em versoes recentes, um `code`
 * estavel (ex.: "user_already_exists", "weak_password"). Preferimos o `code`
 * e caimos no texto da mensagem quando ele nao vem.
 */
type SupabaseAuthError = {
  code?: string;
  message?: string;
  status?: number;
};

export type TranslatedError = { message: string; status: number };

/** Erro de LOGIN. Mantem mensagem unica para credenciais (anti-enumeracao). */
export function translateLoginError(error: SupabaseAuthError): TranslatedError {
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();

  if (code === "email_not_confirmed" || msg.includes("not confirmed")) {
    return { message: "Confirme seu e-mail antes de entrar.", status: 403 };
  }
  if (isRateLimit(code, msg)) {
    return { message: "Muitas tentativas. Aguarde um instante e tente de novo.", status: 429 };
  }
  // Credenciais erradas / usuario inexistente: mesma mensagem para nao revelar
  // se o e-mail existe.
  return { message: "E-mail ou senha incorretos.", status: 401 };
}

/** Erro de CADASTRO. */
export function translateRegisterError(error: SupabaseAuthError): TranslatedError {
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();

  if (
    code === "user_already_exists" ||
    code === "email_exists" ||
    msg.includes("already registered") ||
    msg.includes("already been registered") ||
    msg.includes("already exists")
  ) {
    return { message: "Este e-mail ja esta cadastrado. Tente entrar.", status: 409 };
  }
  if (code === "weak_password" || msg.includes("password")) {
    return {
      message: "Senha muito fraca. Use ao menos 8 caracteres.",
      status: 400,
    };
  }
  if (code === "email_address_invalid" || (msg.includes("email") && msg.includes("invalid"))) {
    return { message: "E-mail invalido.", status: 400 };
  }
  if (code === "signup_disabled" || msg.includes("signups not allowed")) {
    return { message: "Os cadastros estao temporariamente desativados.", status: 403 };
  }
  if (isRateLimit(code, msg)) {
    return { message: "Muitas tentativas. Aguarde um instante e tente de novo.", status: 429 };
  }
  return { message: "Nao foi possivel criar a conta. Tente novamente.", status: 400 };
}

function isRateLimit(code: string, msg: string): boolean {
  return (
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    msg.includes("rate limit")
  );
}
