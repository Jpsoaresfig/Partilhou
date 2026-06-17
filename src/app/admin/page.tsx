import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatBRL } from "@/lib/money";
import ResolveDispute from "@/components/ResolveDispute";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (user.app_metadata?.is_admin !== true) redirect("/");

  // Service role: admin nao e parte do pedido, entao a RLS nao se aplica aqui.
  const admin = createSupabaseAdminClient();
  const { data: disputes } = await admin
    .from("orders")
    .select("id, amount_total_cents, commission_cents, seller_net_cents, dispute_reason, created_at")
    .eq("payment_status", "em_disputa")
    .order("created_at", { ascending: false });

  return (
    <main className="container mt-3 mb-3">
      <h1>Mediacao de disputas</h1>
      <p className="muted mb-3">Analise as provas e decida liberar ao vendedor ou estornar ao comprador.</p>

      {!disputes?.length ? (
        <div className="card empty">Nenhuma disputa aberta. 🎉</div>
      ) : (
        <div className="stack">
          {disputes.map((o) => (
            <div key={o.id} className="card">
              <div className="row between wrap">
                <div>
                  <strong>Pedido #{o.id.slice(0, 8)}</strong>
                  <div className="muted small">Total {formatBRL(o.amount_total_cents)} · liquido {formatBRL(o.seller_net_cents)} · comissao {formatBRL(o.commission_cents)}</div>
                </div>
                <ResolveDispute orderId={o.id} />
              </div>
              {o.dispute_reason && (
                <div className="split-box mt-1">
                  <span className="muted small">Motivo: </span>{o.dispute_reason}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
