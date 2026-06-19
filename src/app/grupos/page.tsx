import Link from "next/link";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { GROUP_THEMES, groupCover, groupIcon, membersLabel } from "@/lib/groups";
import GroupJoinButton from "@/components/GroupJoinButton";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Grupos — Partilhou",
  description:
    "Comunidades de compra, venda e promocoes. Compartilhe achados, cupons e ofertas com outras pessoas.",
};

type GroupRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  cover: string | null;
  theme: string;
  region_uf: string | null;
  members_count: number;
  posts_count: number;
};

type Search = { tema?: string };

export default async function GruposPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { tema } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const { user } = await getServerUser();

  let query = supabase
    .from("groups")
    .select(
      "id, slug, name, description, icon, cover, theme, region_uf, members_count, posts_count",
    )
    .eq("visibility", "publico")
    .order("members_count", { ascending: false })
    .limit(48);

  if (tema && tema !== "todos") query = query.eq("theme", tema);

  const { data: groups } = await query;
  const list = (groups ?? []) as GroupRow[];

  // Quais desses grupos o usuario ja participa (para mostrar "Participando").
  let memberOf = new Set<string>();
  if (user && list.length > 0) {
    const { data: mems } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("profile_id", user.id)
      .in(
        "group_id",
        list.map((g) => g.id),
      );
    memberOf = new Set((mems ?? []).map((m) => m.group_id as string));
  }

  const createHref = user ? "/grupos/criar" : "/login";

  return (
    <main>
      <section className="container hero" style={{ paddingBottom: "1.25rem" }}>
        <span className="badge badge-accent mb-2">🔥 Comunidade</span>
        <h1>
          Grupos de <span className="gradient">promocoes</span> e vendas
        </h1>
        <p className="lead">
          Entre em comunidades por tema ou regiao para compartilhar achados,
          cupons e links de oferta — de qualquer loja ou da propria Partilhou.
          Quem participa fica sabendo das promocoes primeiro.
        </p>
        <div className="row" style={{ justifyContent: "center" }}>
          <Link href={createHref} className="btn btn-primary btn-lg">
            <span className="btn-ico" aria-hidden>➕</span>
            Criar um grupo
          </Link>
          <Link href="/" className="btn btn-ghost btn-lg">
            <span className="btn-ico" aria-hidden>🛍️</span>
            Ver a vitrine
          </Link>
        </div>
      </section>

      <section className="container mb-3">
        {/* Filtro por tema (links GET — funciona sem JS). */}
        <div className="group-chips">
          <Link
            href="/grupos"
            className={`chip-toggle${!tema || tema === "todos" ? " active" : ""}`}
          >
            🌐 Todos
          </Link>
          {GROUP_THEMES.filter((t) => t.slug !== "geral").map((t) => (
            <Link
              key={t.slug}
              href={`/grupos?tema=${t.slug}`}
              className={`chip-toggle${tema === t.slug ? " active" : ""}`}
            >
              {t.icon} {t.label}
            </Link>
          ))}
        </div>

        <div className="row between mb-2">
          <h2 style={{ margin: 0 }}>Grupos em destaque</h2>
          <span className="muted small">{list.length} grupos</span>
        </div>

        {list.length === 0 ? (
          <div className="card empty">
            Nenhum grupo por aqui ainda. Que tal{" "}
            <Link href={createHref} style={{ color: "var(--primary)" }}>
              criar o primeiro
            </Link>
            ?
          </div>
        ) : (
          <div className="groups-grid">
            {list.map((g) => (
              <article key={g.id} className="card group-card">
                <div
                  className="group-cover"
                  style={{ background: groupCover(g.cover, g.theme) }}
                >
                  <span aria-hidden>{groupIcon(g.icon, g.theme)}</span>
                </div>
                <div className="group-body">
                  <div className="group-name">{g.name}</div>
                  <div className="group-meta">
                    <span>{membersLabel(g.members_count)}</span>
                    <span className="dot-sep">•</span>
                    <span>{g.posts_count} posts</span>
                    {g.region_uf && (
                      <>
                        <span className="dot-sep">•</span>
                        <span>📍 {g.region_uf}</span>
                      </>
                    )}
                  </div>
                  {g.description && <p className="group-desc">{g.description}</p>}
                  <GroupJoinButton
                    groupId={g.id}
                    authed={Boolean(user)}
                    isMember={memberOf.has(g.id)}
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
