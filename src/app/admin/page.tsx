import Link from "next/link";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerUser } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatBRL } from "@/lib/money";
import { groupsEnabled } from "@/lib/flags";
import StatusBadge from "@/components/StatusBadge";
import ResolveDispute from "@/components/ResolveDispute";
import ResolveReport from "@/components/ResolveReport";
import ReviewProduct from "@/components/ReviewProduct";
import FeatureToggle from "@/components/FeatureToggle";

export const dynamic = "force-dynamic";

// Limite defensivo de linhas por listagem (evita payloads gigantes no painel).
const CAP = 500;

type Tab =
  | "geral"
  | "usuarios"
  | "pedidos"
  | "produtos"
  | "financeiro"
  | "avaliacoes"
  | "reportes"
  | "disputas"
  | "grupos"
  | "afiliados"
  | "config";

const TABS: { key: Tab; label: string }[] = [
  { key: "geral", label: "Visao geral" },
  { key: "usuarios", label: "Usuarios" },
  { key: "pedidos", label: "Pedidos" },
  { key: "produtos", label: "Produtos" },
  { key: "financeiro", label: "Financeiro" },
  { key: "avaliacoes", label: "Avaliacoes" },
  { key: "reportes", label: "Reportes" },
  { key: "disputas", label: "Disputas" },
  { key: "grupos", label: "Grupos" },
  { key: "afiliados", label: "Afiliados" },
  { key: "config", label: "Configuracoes" },
];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: Tab }>;
}) {
  const { tab = "geral" } = await searchParams;
  const { user } = await getServerUser();
  if (!user) redirect("/login");
  if (user.app_metadata?.is_admin !== true) redirect("/");

  // Service role: o admin nao e parte das linhas, entao a RLS as esconderia.
  const admin = createSupabaseAdminClient();

  return (
    <main className="container mt-3 mb-3">
      <div className="row between wrap mb-2">
        <h1 style={{ margin: 0 }}>Painel do administrador</h1>
        <span className="muted small">Visao completa do sistema</span>
      </div>

      <div className="tabs" style={{ flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin?tab=${t.key}`}
            className={`tab ${tab === t.key ? "active" : ""}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "geral" && <Geral admin={admin} />}
      {tab === "usuarios" && <Usuarios admin={admin} />}
      {tab === "pedidos" && <Pedidos admin={admin} />}
      {tab === "produtos" && <Produtos admin={admin} />}
      {tab === "financeiro" && <Financeiro admin={admin} />}
      {tab === "avaliacoes" && <Avaliacoes admin={admin} />}
      {tab === "reportes" && <Reportes admin={admin} />}
      {tab === "disputas" && <Disputas admin={admin} />}
      {tab === "grupos" && <Grupos admin={admin} />}
      {tab === "afiliados" && <Afiliados admin={admin} />}
      {tab === "config" && <Config admin={admin} />}
    </main>
  );
}

/* ------------------------------------------------------------------ helpers */

type Sb = SupabaseClient;

async function count(admin: Sb, table: string): Promise<number> {
  const { count } = await admin.from(table).select("*", { count: "exact", head: true });
  return count ?? 0;
}

async function countWhere(
  admin: Sb,
  table: string,
  col: string,
  value: string,
): Promise<number> {
  const { count } = await admin
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(col, value);
  return count ?? 0;
}

function sum<T>(rows: T[] | null, pick: (r: T) => number): number {
  return (rows ?? []).reduce((acc, r) => acc + (pick(r) || 0), 0);
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="card empty">{children}</div>;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card" style={{ padding: "1rem" }}>
      <div className="muted small">{label}</div>
      <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: 4 }}>{value}</div>
      {hint && <div className="muted small" style={{ marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

function short(id: string) {
  return id.slice(0, 8);
}

function date(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("pt-BR");
}

/* --------------------------------------------------------------- VISAO GERAL */

async function Geral({ admin }: { admin: Sb }) {
  const [
    usuarios,
    produtosTotal,
    produtosAtivos,
    pedidosTotal,
    disputas,
    reportesAbertos,
    avaliacoes,
    grupos,
    posts,
    { data: orders },
    { data: saques },
  ] = await Promise.all([
    count(admin, "profiles"),
    count(admin, "products"),
    countWhere(admin, "products", "status", "ativo"),
    count(admin, "orders"),
    countWhere(admin, "orders", "payment_status", "em_disputa"),
    countWhere(admin, "problem_reports", "status", "aberto"),
    count(admin, "ratings"),
    count(admin, "groups"),
    count(admin, "group_posts"),
    admin
      .from("orders")
      .select("amount_total_cents, platform_fee_cents, payment_status, funds_state")
      .limit(10000),
    admin
      .from("withdrawals")
      .select("amount_cents, status")
      .limit(10000),
  ]);

  const pagos = (orders ?? []).filter(
    (o) => o.payment_status === "aprovado" || o.payment_status === "concluido",
  );
  const gmv = sum(pagos, (o) => o.amount_total_cents);
  const receita = sum(
    (orders ?? []).filter((o) => o.funds_state === "liberado"),
    (o) => o.platform_fee_cents,
  );
  const escrow = sum(
    (orders ?? []).filter((o) => o.funds_state === "retido"),
    (o) => o.amount_total_cents,
  );
  const saquesPendentes = (saques ?? []).filter(
    (s) => s.status === "solicitado" || s.status === "processando",
  );
  const saquePend = sum(saquesPendentes, (s) => s.amount_cents);

  return (
    <div className="stack">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
          gap: 12,
        }}
      >
        <Stat label="Usuarios" value={String(usuarios)} />
        <Stat label="Produtos" value={String(produtosTotal)} hint={`${produtosAtivos} ativos`} />
        <Stat label="Pedidos" value={String(pedidosTotal)} hint={`${pagos.length} pagos`} />
        <Stat label="GMV (vendas pagas)" value={formatBRL(gmv)} />
        <Stat label="Receita da plataforma" value={formatBRL(receita)} hint="taxas liberadas" />
        <Stat label="Retido em escrow" value={formatBRL(escrow)} />
        <Stat
          label="Saques pendentes"
          value={formatBRL(saquePend)}
          hint={`${saquesPendentes.length} solicitacoes`}
        />
        <Stat label="Disputas abertas" value={String(disputas)} />
        <Stat label="Reportes abertos" value={String(reportesAbertos)} />
        <Stat label="Avaliacoes" value={String(avaliacoes)} />
        <Stat label="Grupos" value={String(grupos)} hint={`${posts} posts`} />
      </div>
      <p className="muted small">
        Use as abas acima para detalhar cada area. Listagens limitadas a {CAP} linhas
        mais recentes.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ USUARIOS */

async function Usuarios({ admin }: { admin: Sb }) {
  // Emails e flag de admin vivem em auth.users; o resto em profiles.
  const [{ data: authList }, { data: profiles }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin
      .from("profiles")
      .select("id, full_name, account_status, city, region_uf, last_seen_at, created_at")
      .order("created_at", { ascending: false })
      .limit(CAP),
  ]);

  const meta = new Map(
    (authList?.users ?? []).map((u) => [
      u.id,
      {
        email: u.email ?? "—",
        isAdmin: (u.app_metadata as { is_admin?: boolean })?.is_admin === true,
      },
    ]),
  );

  if (!profiles?.length) return <Empty>Nenhum usuario.</Empty>;

  return (
    <table className="list">
      <thead>
        <tr>
          <th>Nome</th>
          <th>E-mail</th>
          <th>Status</th>
          <th>Local</th>
          <th>Cadastro</th>
          <th>Papel</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {profiles.map((p) => {
          const m = meta.get(p.id);
          return (
            <tr key={p.id}>
              <td>{p.full_name}</td>
              <td className="muted small">{m?.email ?? "—"}</td>
              <td><span className="badge">{p.account_status}</span></td>
              <td className="muted small">
                {[p.city, p.region_uf].filter(Boolean).join(" / ") || "—"}
              </td>
              <td className="muted small">{date(p.created_at)}</td>
              <td>{m?.isAdmin ? <span className="badge badge-primary">admin</span> : "—"}</td>
              <td>
                <Link href={`/loja/${p.id}`} className="btn btn-sm btn-ghost">Loja</Link>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ------------------------------------------------------------------- PEDIDOS */

async function Pedidos({ admin }: { admin: Sb }) {
  const { data } = await admin
    .from("orders")
    .select(
      "id, amount_total_cents, commission_cents, platform_fee_cents, seller_net_cents, payment_status, delivery_status, funds_state, affiliate_id, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(CAP);

  if (!data?.length) return <Empty>Nenhum pedido.</Empty>;

  return (
    <table className="list">
      <thead>
        <tr>
          <th>Pedido</th>
          <th>Total</th>
          <th>Comissao</th>
          <th>Taxa</th>
          <th>Liquido</th>
          <th>Pagamento</th>
          <th>Entrega</th>
          <th>Fundos</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {data.map((o) => (
          <tr key={o.id}>
            <td className="muted small">
              {short(o.id)}
              {o.affiliate_id && <span className="badge badge-accent" style={{ marginLeft: 6 }}>afiliado</span>}
            </td>
            <td>{formatBRL(o.amount_total_cents)}</td>
            <td>{formatBRL(o.commission_cents)}</td>
            <td>{formatBRL(o.platform_fee_cents)}</td>
            <td>{formatBRL(o.seller_net_cents)}</td>
            <td><StatusBadge status={o.payment_status} /></td>
            <td><StatusBadge status={o.delivery_status} /></td>
            <td><StatusBadge status={o.funds_state} /></td>
            <td><Link href={`/pedidos/${o.id}`} className="btn btn-sm btn-ghost">Abrir</Link></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ------------------------------------------------------------------ PRODUTOS */

async function Produtos({ admin }: { admin: Sb }) {
  const { data } = await admin
    .from("products")
    .select(
      "id, title, amount_total_cents, min_price_cents, commission_bps, status, category, region_uf, imei, review_status, trust_score, created_at",
    )
    // Pendentes de validacao primeiro (fila de moderacao), depois os mais recentes.
    .order("review_status", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(CAP);

  if (!data?.length) return <Empty>Nenhum produto.</Empty>;

  const pendentes = data.filter((p) => p.review_status === "pending_review").length;

  return (
    <div className="stack">
      <p className="muted small">
        {pendentes > 0
          ? `${pendentes} anuncio(s) aguardando validacao. Confira fotos + IMEI antes de aprovar.`
          : "Nenhum anuncio aguardando validacao."}
      </p>
      <table className="list">
        <thead>
          <tr>
            <th>Produto</th>
            <th>Preco</th>
            <th>Comissao</th>
            <th>IMEI</th>
            <th>Validacao</th>
            <th>Acao</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.id}>
              <td>
                <Link href={`/produto/${p.id}`}>{p.title}</Link>
                <div className="muted small">{p.category} · {p.region_uf ?? "—"}</div>
              </td>
              <td>
                {formatBRL(p.amount_total_cents)}
                {p.min_price_cents && (
                  <span className="muted small"> (min {formatBRL(p.min_price_cents)})</span>
                )}
              </td>
              <td>{(p.commission_bps / 100).toFixed(0)}%</td>
              <td className="muted small">{p.imei ? <code>{p.imei}</code> : "—"}</td>
              <td>
                <span className="badge">{p.review_status}</span>
                <div className="muted small">score {p.trust_score}/100</div>
              </td>
              <td>
                <ReviewProduct
                  productId={p.id}
                  reviewStatus={p.review_status}
                  trustScore={p.trust_score}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------------------------------------------- FINANCEIRO */

async function Financeiro({ admin }: { admin: Sb }) {
  const [{ data: saques }, { data: ledger }, { data: eventos }] = await Promise.all([
    admin
      .from("withdrawals")
      .select("id, user_id, amount_cents, status, pix_key, created_at")
      .order("created_at", { ascending: false })
      .limit(CAP),
    admin
      .from("ledger_entries")
      .select("id, type, account, amount_cents, order_id, created_at")
      .order("id", { ascending: false })
      .limit(100),
    admin
      .from("payment_events")
      .select("id, provider, event_type, status, order_id, received_at")
      .order("id", { ascending: false })
      .limit(100),
  ]);

  return (
    <div className="stack">
      <section>
        <h3>Saques</h3>
        {!saques?.length ? (
          <Empty>Nenhum saque.</Empty>
        ) : (
          <table className="list">
            <thead>
              <tr><th>ID</th><th>Usuario</th><th>Valor</th><th>Chave PIX</th><th>Status</th><th>Data</th></tr>
            </thead>
            <tbody>
              {saques.map((s) => (
                <tr key={s.id}>
                  <td className="muted small">{short(s.id)}</td>
                  <td className="muted small">{short(s.user_id)}</td>
                  <td>{formatBRL(s.amount_cents)}</td>
                  <td className="muted small">{s.pix_key ?? "—"}</td>
                  <td><span className="badge">{s.status}</span></td>
                  <td className="muted small">{date(s.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h3>Razao (ultimos 100 lancamentos)</h3>
        {!ledger?.length ? (
          <Empty>Nenhum lancamento.</Empty>
        ) : (
          <table className="list">
            <thead>
              <tr><th>#</th><th>Tipo</th><th>Conta</th><th>Valor</th><th>Pedido</th><th>Data</th></tr>
            </thead>
            <tbody>
              {ledger.map((l) => (
                <tr key={l.id}>
                  <td className="muted small">{l.id}</td>
                  <td>{l.type}</td>
                  <td className="muted small">{l.account}</td>
                  <td style={{ color: l.amount_cents < 0 ? "var(--danger)" : undefined }}>
                    {formatBRL(l.amount_cents)}
                  </td>
                  <td className="muted small">{l.order_id ? short(l.order_id) : "—"}</td>
                  <td className="muted small">{date(l.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h3>Eventos de pagamento (webhooks)</h3>
        {!eventos?.length ? (
          <Empty>Nenhum evento.</Empty>
        ) : (
          <table className="list">
            <thead>
              <tr><th>#</th><th>Provedor</th><th>Evento</th><th>Status</th><th>Pedido</th><th>Data</th></tr>
            </thead>
            <tbody>
              {eventos.map((e) => (
                <tr key={e.id}>
                  <td className="muted small">{e.id}</td>
                  <td>{e.provider}</td>
                  <td className="muted small">{e.event_type}</td>
                  <td><span className="badge">{e.status}</span></td>
                  <td className="muted small">{e.order_id ? short(e.order_id) : "—"}</td>
                  <td className="muted small">{date(e.received_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

/* ----------------------------------------------------------------- AVALIACOES */

async function Avaliacoes({ admin }: { admin: Sb }) {
  const { data } = await admin
    .from("ratings")
    .select("id, order_id, rater_id, ratee_id, role, score, comment, created_at")
    .order("created_at", { ascending: false })
    .limit(CAP);

  if (!data?.length) return <Empty>Nenhuma avaliacao.</Empty>;

  return (
    <table className="list">
      <thead>
        <tr><th>Pedido</th><th>Papel</th><th>Nota</th><th>Comentario</th><th>De → Para</th><th>Data</th></tr>
      </thead>
      <tbody>
        {data.map((r) => (
          <tr key={r.id}>
            <td className="muted small">{short(r.order_id)}</td>
            <td>{r.role}</td>
            <td>{"⭐".repeat(r.score)} <span className="muted small">{r.score}/5</span></td>
            <td>{r.comment || <span className="muted small">—</span>}</td>
            <td className="muted small">{short(r.rater_id)} → {short(r.ratee_id)}</td>
            <td className="muted small">{date(r.created_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ------------------------------------------------------------------ REPORTES */

async function Reportes({ admin }: { admin: Sb }) {
  const { data } = await admin
    .from("problem_reports")
    .select("id, user_id, email, category, message, url, status, created_at")
    .order("created_at", { ascending: false })
    .limit(CAP);

  if (!data?.length) return <Empty>Nenhum reporte.</Empty>;

  return (
    <div className="stack">
      {data.map((r) => (
        <div key={r.id} className="card">
          <div className="row between wrap">
            <div>
              <strong>{r.category}</strong>{" "}
              <span className={`badge ${r.status === "resolvido" ? "badge-primary" : "badge-warn"}`}>
                {r.status}
              </span>
              <div className="muted small">
                {r.email || (r.user_id ? `usuario ${short(r.user_id)}` : "anonimo")} · {date(r.created_at)}
              </div>
            </div>
            <ResolveReport reportId={r.id} status={r.status} />
          </div>
          <p style={{ marginTop: 8, marginBottom: 4 }}>{r.message}</p>
          {r.url && (
            <div className="muted small">
              Pagina: <code>{r.url}</code>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ DISPUTAS */

async function Disputas({ admin }: { admin: Sb }) {
  const { data: disputes } = await admin
    .from("orders")
    .select("id, amount_total_cents, commission_cents, seller_net_cents, dispute_reason, created_at")
    .eq("payment_status", "em_disputa")
    .order("created_at", { ascending: false });

  if (!disputes?.length) return <Empty>Nenhuma disputa aberta. 🎉</Empty>;

  return (
    <div className="stack">
      <p className="muted">Analise as provas e decida liberar ao vendedor ou estornar ao comprador.</p>
      {disputes.map((o) => (
        <div key={o.id} className="card">
          <div className="row between wrap">
            <div>
              <strong>Pedido #{short(o.id)}</strong>
              <div className="muted small">
                Total {formatBRL(o.amount_total_cents)} · liquido {formatBRL(o.seller_net_cents)} · comissao {formatBRL(o.commission_cents)}
              </div>
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
  );
}

/* -------------------------------------------------------------------- GRUPOS */

async function Grupos({ admin }: { admin: Sb }) {
  const enabled = await groupsEnabled();
  const { data } = await admin
    .from("groups")
    .select("id, name, slug, theme, visibility, region_uf, members_count, posts_count, created_at")
    .order("members_count", { ascending: false })
    .limit(CAP);

  return (
    <div className="stack">
      <div className="card">
        <div className="row between wrap">
          <div>
            <strong>Area de Grupos</strong>
            <div className="muted small">
              Controla se a aba de Grupos (comunidades) aparece para todos no site.
            </div>
          </div>
          <FeatureToggle
            settingKey="groups_enabled"
            enabled={enabled}
            labelOn="Visivel"
            labelOff="Oculto"
          />
        </div>
      </div>

      {!data?.length ? (
        <Empty>Nenhum grupo criado.</Empty>
      ) : (
        <table className="list">
          <thead>
            <tr><th>Grupo</th><th>Tema</th><th>Visibilidade</th><th>UF</th><th>Membros</th><th>Posts</th><th>Criado</th></tr>
          </thead>
          <tbody>
            {data.map((g) => (
              <tr key={g.id}>
                <td>{g.name} <span className="muted small">/{g.slug}</span></td>
                <td className="muted small">{g.theme}</td>
                <td><span className="badge">{g.visibility}</span></td>
                <td className="muted small">{g.region_uf ?? "—"}</td>
                <td>{g.members_count}</td>
                <td>{g.posts_count}</td>
                <td className="muted small">{date(g.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ AFILIADOS */

async function Afiliados({ admin }: { admin: Sb }) {
  const [{ data: links }, cliques] = await Promise.all([
    admin
      .from("affiliate_links")
      .select("id, affiliate_id, product_id, tracking_code, clicks, sale_price_cents, created_at")
      .order("clicks", { ascending: false })
      .limit(CAP),
    count(admin, "affiliate_clicks"),
  ]);

  return (
    <div className="stack">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
          gap: 12,
        }}
      >
        <Stat label="Links de afiliado" value={String(links?.length ?? 0)} />
        <Stat label="Cliques registrados" value={String(cliques)} />
      </div>

      {!links?.length ? (
        <Empty>Nenhum link de afiliado.</Empty>
      ) : (
        <table className="list">
          <thead>
            <tr><th>Codigo</th><th>Afiliado</th><th>Produto</th><th>Preco</th><th>Cliques</th><th>Criado</th></tr>
          </thead>
          <tbody>
            {links.map((l) => (
              <tr key={l.id}>
                <td><code>{l.tracking_code}</code></td>
                <td className="muted small">{short(l.affiliate_id)}</td>
                <td className="muted small">{short(l.product_id)}</td>
                <td>{l.sale_price_cents ? formatBRL(l.sale_price_cents) : <span className="muted small">alvo</span>}</td>
                <td>{l.clicks}</td>
                <td className="muted small">{date(l.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- CONFIGURACOES */

async function Config({ admin }: { admin: Sb }) {
  const { data } = await admin
    .from("platform_settings")
    .select("key, value, description, updated_at")
    .order("key");

  if (!data?.length) return <Empty>Nenhuma configuracao.</Empty>;

  return (
    <div className="stack">
      <p className="muted small">
        Parametros da plataforma. A edicao de cada valor pode ser feita via API admin;
        a flag de Grupos tem botao proprio na aba Grupos.
      </p>
      <table className="list">
        <thead>
          <tr><th>Chave</th><th>Valor</th><th>Descricao</th><th>Atualizado</th></tr>
        </thead>
        <tbody>
          {data.map((s) => (
            <tr key={s.key}>
              <td><code>{s.key}</code></td>
              <td><strong>{s.value}</strong></td>
              <td className="muted small">{s.description}</td>
              <td className="muted small">{date(s.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
