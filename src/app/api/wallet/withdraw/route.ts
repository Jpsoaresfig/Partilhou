/**
 * POST /api/wallet/withdraw  { amount, pix_key }
 * Solicita saque do saldo_disponivel. Debita atomicamente (evita saldo negativo
 * e saque em dobro) e cria o registro de payout. O disbursement PIX real e
 * disparado a seguir pelo processador de payouts (TODO de producao).
 */
import { requireUser } from "@/lib/auth";
import { appRpc } from "@/lib/supabase/admin";
import { ok, handleError, readJson } from "@/lib/http";
import { withdrawSchema } from "@/lib/validation";
import { toCents } from "@/lib/money";

export async function POST(req: Request) {
  try {
    const { user } = await requireUser();
    const body = withdrawSchema.parse(await readJson(req));

    const { data, error } = await appRpc().rpc("request_withdrawal", {
      p_user_id: user.id,
      p_amount_cents: toCents(body.amount),
      p_pix_key: body.pix_key,
    });
    if (error) throw error;

    // TODO(producao): enfileirar a transferencia PIX no gateway. Em caso de
    // falha do disbursement, chamar app.fail_withdrawal(id) para devolver o saldo.
    return ok({ withdrawal: data }, 201);
  } catch (err) {
    return handleError(err);
  }
}
