import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/money";
import WithdrawForm from "@/components/WithdrawForm";

export const dynamic = "force-dynamic";

const LEDGER_LABEL: Record<string, string> = {
  captura: "Venda (retido)",
  liberacao: "Liberacao",
  estorno: "Estorno",
  saque: "Saque",
  ajuste: "Ajuste",
};

export default async function CarteiraPage() {
  const { supabase, user } = await getServerUser();
  if (!user) redirect("/login");

  const [{ data: wallet }, { data: ledger }] = await Promise.all([
    supabase.from("wallets").select("*").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("ledger_entries")
      .select("id, type, account, amount_cents, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const pending = wallet?.balance_pending_cents ?? 0;
  const available = wallet?.balance_available_cents ?? 0;

  return (
    <main className="container mt-3 mb-3" style={{ maxWidth: 860 }}>
      <h1>Carteira</h1>

      <div className="cols-2">
        <div className="card">
          <span className="muted small">Saldo pendente (em escrow)</span>
          <div className="price mt-1">{formatBRL(pending)}</div>
          <p className="muted small">Liberado apos a confirmacao de entrega.</p>
        </div>
        <div className="card">
          <span className="muted small">Saldo disponivel</span>
          <div className="price mt-1" style={{ color: "var(--primary)" }}>{formatBRL(available)}</div>
          <p className="muted small">Pronto para saque via PIX.</p>
        </div>
      </div>

      <div className="cols-2-wide mt-2">
        <div className="card">
          <h3>Sacar</h3>
          <WithdrawForm availableCents={available} />
        </div>

        <div className="card">
          <h3>Extrato</h3>
          {!ledger?.length ? (
            <div className="empty">Sem movimentacoes ainda.</div>
          ) : (
            <table className="list">
              <thead><tr><th>Tipo</th><th>Conta</th><th style={{ textAlign: "right" }}>Valor</th></tr></thead>
              <tbody>
                {ledger.map((e) => (
                  <tr key={e.id}>
                    <td>{LEDGER_LABEL[e.type] ?? e.type}</td>
                    <td className="muted small">{e.account.replace("usuario_", "")}</td>
                    <td style={{ textAlign: "right", color: e.amount_cents >= 0 ? "var(--primary)" : "var(--danger)" }}>
                      {e.amount_cents >= 0 ? "+" : "−"}{formatBRL(Math.abs(e.amount_cents))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
