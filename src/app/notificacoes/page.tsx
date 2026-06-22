import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import MarkAllReadButton from "@/components/MarkAllReadButton";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  compra: "Compra",
  venda: "Venda",
  comissao: "Comissao",
  envio: "Envio",
  liberacao: "Liberacao",
  disputa: "Disputa",
  estorno: "Estorno",
  saque: "Saque",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `ha ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `ha ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `ha ${d} d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default async function NotificacoesPage() {
  const { supabase, user } = await getServerUser();
  if (!user) redirect("/login");

  const { data: items } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const list = items ?? [];
  const unread = list.filter((n) => !n.read_at).length;

  return (
    <main className="container mt-3 mb-3" style={{ maxWidth: 760 }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Notificacoes</h1>
        {unread > 0 && <span className="badge badge-primary">{unread} nova{unread > 1 ? "s" : ""}</span>}
        <div style={{ marginLeft: "auto" }}>
          {unread > 0 && <MarkAllReadButton />}
        </div>
      </div>

      {!list.length ? (
        <div className="empty mt-2">Voce ainda nao tem notificacoes.</div>
      ) : (
        <div className="notif-list mt-2">
          {list.map((n) => {
            const inner = (
              <>
                <div className="notif-head">
                  {!n.read_at && <span className="notif-dot" aria-label="nao lida" />}
                  <span className="notif-title">{n.title}</span>
                  <span className="badge">{TYPE_LABEL[n.type] ?? n.type}</span>
                  <span className="muted small" style={{ marginLeft: "auto" }}>{timeAgo(n.created_at)}</span>
                </div>
                {n.body && <p className="muted small notif-body">{n.body}</p>}
              </>
            );
            return n.link ? (
              <Link key={n.id} href={n.link} className={`notif card${n.read_at ? "" : " notif-unread"}`}>
                {inner}
              </Link>
            ) : (
              <div key={n.id} className={`notif card${n.read_at ? "" : " notif-unread"}`}>
                {inner}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
