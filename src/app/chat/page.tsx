import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Conv = {
  id: string;
  product_id: string;
  seller_id: string;
  affiliate_id: string;
  updated_at: string;
};

/** Tempo relativo curto (pt-BR) para a caixa de entrada. */
function ago(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}

export default async function ChatListPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS restringe a conversas em que o usuario participa.
  const { data: convsData } = await supabase
    .from("conversations")
    .select("id, product_id, seller_id, affiliate_id, updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);
  const convs = (convsData ?? []) as Conv[];

  // Carrega titulos dos produtos e nomes das contrapartes em lote.
  const productIds = [...new Set(convs.map((c) => c.product_id))];
  const otherIds = [
    ...new Set(convs.map((c) => (c.seller_id === user.id ? c.affiliate_id : c.seller_id))),
  ];

  const [{ data: products }, { data: profiles }, { data: unreadRows }] = await Promise.all([
    productIds.length
      ? supabase.from("products").select("id, title").in("id", productIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    otherIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", otherIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    convs.length
      ? supabase
          .from("messages")
          .select("conversation_id")
          .neq("sender_id", user.id)
          .is("read_at", null)
          .in(
            "conversation_id",
            convs.map((c) => c.id),
          )
      : Promise.resolve({ data: [] as { conversation_id: string }[] }),
  ]);

  const titleOf = new Map((products ?? []).map((p) => [p.id, p.title]));
  const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const unreadOf = new Map<string, number>();
  for (const r of unreadRows ?? []) {
    unreadOf.set(r.conversation_id, (unreadOf.get(r.conversation_id) ?? 0) + 1);
  }

  return (
    <main className="container mt-3 mb-3" style={{ maxWidth: 760 }}>
      <h1>Conversas</h1>
      <p className="muted small" style={{ marginTop: -6 }}>
        Mensagens entre afiliados e vendedores.
      </p>

      {convs.length === 0 ? (
        <div className="card empty">
          Nenhuma conversa ainda. Em um anuncio de outra pessoa, use{" "}
          <strong>“Conversar com o vendedor”</strong> para iniciar.
        </div>
      ) : (
        <div className="stack">
          {convs.map((c) => {
            const otherId = c.seller_id === user.id ? c.affiliate_id : c.seller_id;
            const youAre = c.seller_id === user.id ? "vendedor" : "afiliado";
            const unread = unreadOf.get(c.id) ?? 0;
            return (
              <Link key={c.id} href={`/chat/${c.id}`} className="card" style={{ display: "block" }}>
                <div className="row between">
                  <strong>{nameOf.get(otherId) ?? "Usuario"}</strong>
                  <span className="muted small">{ago(c.updated_at)}</span>
                </div>
                <div className="muted small">{titleOf.get(c.product_id) ?? "Anuncio"}</div>
                <div className="row between mt-1">
                  <span className="badge">Voce: {youAre}</span>
                  {unread > 0 && (
                    <span className="badge badge-accent">{unread} nova(s)</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
