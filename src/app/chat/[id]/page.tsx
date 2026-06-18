import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ChatThread, { type ChatMessage } from "@/components/ChatThread";

export const dynamic = "force-dynamic";

export default async function ChatThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS: so participantes leem a conversa. Nao-participante => maybeSingle null.
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, product_id, seller_id, affiliate_id")
    .eq("id", id)
    .maybeSingle();
  if (!conv) notFound();

  const otherId = conv.seller_id === user.id ? conv.affiliate_id : conv.seller_id;

  const [{ data: product }, { data: other }, { data: msgs }] = await Promise.all([
    supabase.from("products").select("title").eq("id", conv.product_id).maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", otherId).maybeSingle(),
    supabase
      .from("messages")
      .select("id, sender_id, body, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .limit(500),
  ]);

  const initial = (msgs ?? []) as ChatMessage[];

  return (
    <main className="container mt-3 mb-3" style={{ maxWidth: 760 }}>
      <Link href="/chat" className="muted small">← Voltar as conversas</Link>
      <div className="card mt-1" style={{ marginBottom: "0.75rem" }}>
        <div className="row between">
          <h1 style={{ fontSize: "1.2rem", margin: 0 }}>{other?.full_name ?? "Usuario"}</h1>
          <Link
            href={`/produto/${conv.product_id}`}
            className="small"
            style={{ color: "var(--primary)" }}
          >
            Ver anuncio
          </Link>
        </div>
        <div className="muted small">{product?.title ?? "Anuncio"}</div>
      </div>

      <ChatThread
        conversationId={conv.id}
        currentUserId={user.id}
        initialMessages={initial}
      />
    </main>
  );
}
