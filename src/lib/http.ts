/**
 * Helpers de resposta HTTP e tratamento de erros para as route handlers.
 * Mapeia erros do Postgres (SQLSTATE) para status HTTP coerentes.
 */
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(message: string, status = 400, extra?: unknown) {
  return NextResponse.json(
    { ok: false, error: message, ...(extra ? { details: extra } : {}) },
    { status },
  );
}

type PgError = { code?: string; message?: string; details?: string };

/** Traduz exceptions (Zod, Postgres/Supabase) em respostas seguras. */
export function handleError(err: unknown) {
  if (err instanceof ZodError) {
    return fail("Dados invalidos", 422, err.flatten());
  }

  const e = err as PgError;
  // SQLSTATEs usados nas funcoes do banco.
  switch (e.code) {
    case "no_data_found":
    case "P0002":
      return fail(e.message ?? "Recurso nao encontrado", 404);
    case "check_violation":
    case "23514":
      return fail(e.message ?? "Operacao nao permitida no estado atual", 409);
    case "insufficient_privilege":
    case "42501":
      return fail(e.message ?? "Sem permissao para esta acao", 403);
    case "23505": // unique_violation
      return fail(e.message ?? "Registro duplicado", 409);
    case "restrict_violation":
    case "23001":
      return fail(e.message ?? "Operacao restrita", 409);
    default:
      break;
  }

  // Nao vaza stack/detalhes internos ao cliente.
  console.error("[api] erro nao tratado:", err);
  return fail("Erro interno", 500);
}

/** Le e valida o JSON do corpo da requisicao. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ZodError([
      { code: "custom", path: [], message: "Corpo JSON invalido" },
    ]);
  }
}
