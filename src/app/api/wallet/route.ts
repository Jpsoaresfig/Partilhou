/**
 * GET /api/wallet — saldos (pendente/disponivel) + extrato (ledger) do usuario.
 */
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";

export async function GET() {
  try {
    const { user, supabase } = await requireUser();

    const [walletRes, ledgerRes] = await Promise.all([
      supabase.from("wallets").select("*").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("ledger_entries")
        .select("id, type, account, amount_cents, order_id, metadata, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    if (walletRes.error) throw walletRes.error;
    if (ledgerRes.error) throw ledgerRes.error;

    return ok({ wallet: walletRes.data, ledger: ledgerRes.data });
  } catch (err) {
    return handleError(err);
  }
}
