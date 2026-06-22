import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/money";
import StatusBadge from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

type Tab = "anuncios" | "vendas" | "compras" | "afiliacoes";

const TABS: { key: Tab; label: string }[] = [
  { key: "anuncios", label: "Meus anuncios" },
  { key: "vendas", label: "Minhas vendas" },
  { key: "compras", label: "Minhas compras" },
  { key: "afiliacoes", label: "Afiliacoes" },
];

export default async function PainelPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: Tab }>;
}) {
  const { tab = "anuncios" } = await searchParams;
  const { user } = await getServerUser();
  if (!user) redirect("/login");

  return (
    <main className="container mt-3 mb-3">
      <h1>Painel</h1>
      <div className="tabs">
        {TABS.map((t) => (
          <Link key={t.key} href={`/painel?tab=${t.key}`} className={`tab ${tab === t.key ? "active" : ""}`}>
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "anuncios" && <Anuncios userId={user.id} />}
      {tab === "vendas" && <Pedidos userId={user.id} column="seller_id" empty="Nenhuma venda ainda." />}
      {tab === "compras" && <Pedidos userId={user.id} column="buyer_id" empty="Nenhuma compra ainda." />}
      {tab === "afiliacoes" && <Afiliacoes userId={user.id} />}
    </main>
  );
}

async function Anuncios({ userId }: { userId: string }) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("products")
    .select("id, title, amount_total_cents, status, created_at")
    .eq("seller_id", userId)
    .order("created_at", { ascending: false });

  if (!data?.length) return <Empty>Voce ainda nao tem anuncios.</Empty>;

  return (
    <table className="list">
      <thead>
        <tr><th>Produto</th><th>Preco</th><th>Status</th><th></th></tr>
      </thead>
      <tbody>
        {data.map((p) => (
          <tr key={p.id}>
            <td>{p.title}</td>
            <td>{formatBRL(p.amount_total_cents)}</td>
            <td><span className="badge">{p.status}</span></td>
            <td>
              <div className="row" style={{ gap: 6 }}>
                <Link href={`/produto/${p.id}`} className="btn btn-sm btn-ghost">Ver</Link>
                <Link href={`/produto/${p.id}/editar`} className="btn btn-sm btn-ghost">Editar</Link>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

async function Pedidos({
  userId,
  column,
  empty,
}: {
  userId: string;
  column: "seller_id" | "buyer_id";
  empty: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("orders")
    .select("id, amount_total_cents, seller_net_cents, commission_cents, payment_status, delivery_status, created_at")
    .eq(column, userId)
    .order("created_at", { ascending: false });

  if (!data?.length) return <Empty>{empty}</Empty>;

  return (
    <table className="list">
      <thead>
        <tr><th>Pedido</th><th>Valor</th><th>Pagamento</th><th>Entrega</th><th></th></tr>
      </thead>
      <tbody>
        {data.map((o) => (
          <tr key={o.id}>
            <td className="muted small">{o.id.slice(0, 8)}</td>
            <td>{formatBRL(o.amount_total_cents)}</td>
            <td><StatusBadge status={o.payment_status} /></td>
            <td><StatusBadge status={o.delivery_status} /></td>
            <td><Link href={`/pedidos/${o.id}`} className="btn btn-sm btn-ghost">Abrir</Link></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

async function Afiliacoes({ userId }: { userId: string }) {
  const supabase = await createSupabaseServerClient();
  const [{ data: links }, { data: orders }] = await Promise.all([
    supabase
      .from("affiliate_links")
      .select("id, product_id, tracking_code, clicks")
      .eq("affiliate_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select("id, commission_cents, payment_status, created_at")
      .eq("affiliate_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="stack">
      <div>
        <h3>Links gerados</h3>
        {!links?.length ? (
          <Empty>Voce ainda nao promoveu produtos.</Empty>
        ) : (
          <table className="list">
            <thead><tr><th>Produto</th><th>Codigo</th><th>Cliques</th><th></th></tr></thead>
            <tbody>
              {links.map((l) => (
                <tr key={l.id}>
                  <td className="muted small">{l.product_id.slice(0, 8)}</td>
                  <td><code>{l.tracking_code}</code></td>
                  <td>{l.clicks}</td>
                  <td><Link href={`/produto/${l.product_id}?ref=${l.tracking_code}`} className="btn btn-sm btn-ghost">Ver</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div>
        <h3>Comissoes</h3>
        {!orders?.length ? (
          <Empty>Nenhuma venda por afiliacao ainda.</Empty>
        ) : (
          <table className="list">
            <thead><tr><th>Pedido</th><th>Comissao</th><th>Status</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="muted small">{o.id.slice(0, 8)}</td>
                  <td>{formatBRL(o.commission_cents)}</td>
                  <td><StatusBadge status={o.payment_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="card empty">{children}</div>;
}
