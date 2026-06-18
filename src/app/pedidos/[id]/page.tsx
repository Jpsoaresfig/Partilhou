import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/money";
import StatusBadge from "@/components/StatusBadge";
import OrderActions from "@/components/OrderActions";
import RatingForm, { type RatingTarget } from "@/components/RatingForm";

export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { id } = await params;
  const { status } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: order } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
  if (!order) notFound();

  const role =
    order.seller_id === user.id ? "seller" : order.affiliate_id === user.id ? "affiliate" : "buyer";

  const myAmount =
    role === "seller" ? order.seller_net_cents : role === "affiliate" ? order.commission_cents : order.amount_total_cents;
  const myLabel =
    role === "seller" ? "Voce recebe (liquido)" : role === "affiliate" ? "Sua comissao" : "Voce pagou";

  // Avaliacao: so o comprador, e so apos o pedido concluido (fundos liberados).
  const canRate = role === "buyer" && order.funds_state === "liberado";
  let ratingTargets: RatingTarget[] = [];
  if (canRate) {
    const { data: existing } = await supabase
      .from("ratings")
      .select("role, score, comment")
      .eq("order_id", order.id);
    const byRole = new Map((existing ?? []).map((r) => [r.role as string, r]));
    ratingTargets = [
      { role: "vendedor" as const, label: "Avaliar o vendedor" },
      ...(order.affiliate_id
        ? [{ role: "afiliado" as const, label: "Avaliar o afiliado" }]
        : []),
    ].map((t) => {
      const ex = byRole.get(t.role);
      return { ...t, existing: ex ? { score: ex.score, comment: ex.comment } : null };
    });
  }

  return (
    <main className="container mt-3 mb-3" style={{ maxWidth: 760 }}>
      <Link href="/painel" className="muted small">← Voltar ao painel</Link>
      <h1 className="mt-1">Pedido #{order.id.slice(0, 8)}</h1>

      {status === "falha" && (
        <div className="alert alert-error">O pagamento nao foi concluido. Tente novamente.</div>
      )}

      <div className="cols-2">
        <div className="card">
          <h3>Status</h3>
          <div className="stack" style={{ gap: "0.5rem" }}>
            <div className="row between"><span className="muted small">Pagamento</span><StatusBadge status={order.payment_status} /></div>
            <div className="row between"><span className="muted small">Entrega</span><StatusBadge status={order.delivery_status} /></div>
            <div className="row between"><span className="muted small">Fundos</span><StatusBadge status={order.funds_state} /></div>
          </div>
        </div>

        <div className="card">
          <h3>Valores</h3>
          <div className="split-box">
            <div className="split-line"><span>Total do pedido</span><span>{formatBRL(order.amount_total_cents)}</span></div>
            {order.affiliate_id && (
              <div className="split-line"><span>Comissao afiliado</span><span>{formatBRL(order.commission_cents)}</span></div>
            )}
            <div className="split-line"><span>Taxa plataforma</span><span>{formatBRL(order.platform_fee_cents)}</span></div>
            <div className="split-line total"><span>{myLabel}</span><span>{formatBRL(myAmount)}</span></div>
          </div>
        </div>
      </div>

      {order.shipping_address && role !== "affiliate" && (
        <div className="card mt-2">
          <h3>Entrega</h3>
          <ShippingAddress addr={order.shipping_address} />
        </div>
      )}

      {order.tracking_code && (
        <p className="muted small mt-2">Rastreio: <code>{order.tracking_code}</code></p>
      )}

      <div className="card mt-2">
        <h3>Acoes</h3>
        <OrderActions
          orderId={order.id}
          role={role}
          paymentStatus={order.payment_status}
          deliveryStatus={order.delivery_status}
          fundsState={order.funds_state}
        />
      </div>

      {canRate && (
        <div className="card mt-2">
          <h3>Avaliacao</h3>
          <p className="muted small" style={{ marginTop: -4 }}>
            Pedido concluido. Conte como foi a sua experiencia — isso forma a
            confiabilidade exibida nos perfis.
          </p>
          <RatingForm orderId={order.id} targets={ratingTargets} />
        </div>
      )}
    </main>
  );
}

function ShippingAddress({ addr }: { addr: Record<string, string> }) {
  const line2 = [addr.district, addr.city && `${addr.city}${addr.state ? ` - ${addr.state}` : ""}`]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="stack" style={{ gap: 2 }}>
      <strong>{addr.recipient}</strong>
      <span className="muted">
        {addr.street}, {addr.number}
        {addr.complement ? ` — ${addr.complement}` : ""}
      </span>
      {line2 && <span className="muted">{line2}</span>}
      {addr.zip && <span className="muted small">CEP {addr.zip}</span>}
    </div>
  );
}
