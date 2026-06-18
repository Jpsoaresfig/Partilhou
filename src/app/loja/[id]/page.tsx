import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ProductCard, { type ProductRow } from "@/components/ProductCard";
import { CATEGORIES } from "@/lib/categories";
import { UFS } from "@/lib/regions";

export const dynamic = "force-dynamic";

type Params = { id: string };
type Search = {
  q?: string;
  categoria?: string;
  uf?: string;
  ordenar?: string;
};

const PRODUCT_COLS =
  "id, title, images, amount_total_cents, commission_bps, commission_cents, category, region_uf, created_at";

/** Indicador de presenca a partir de last_seen_at. Null = sem dado (nao exibir). */
function presence(lastSeen: string | null): { online: boolean; label: string } | null {
  if (!lastSeen) return null;
  const min = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 60000);
  if (min < 5) return { online: true, label: "Online" };
  if (min < 60) return { online: false, label: `Visto ha ${min} min` };
  const h = Math.floor(min / 60);
  if (h < 24) return { online: false, label: `Visto ha ${h} h` };
  return { online: false, label: `Visto ha ${Math.floor(h / 24)} d` };
}

export default async function LojaPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { id } = await params;
  const { q, categoria, uf, ordenar } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: seller } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, account_status, city, region_uf, created_at, last_seen_at")
    .eq("id", id)
    .maybeSingle();

  if (!seller) notFound();

  const isOwner = user?.id === seller.id;

  // Reputacao como vendedor (publica).
  const { data: rep } = await supabase
    .from("profile_reputation")
    .select("avg_score, ratings_count")
    .eq("ratee_id", id)
    .eq("role", "vendedor")
    .maybeSingle();

  // Dados privados (telefone) so quando o proprio dono visita a propria loja.
  let ownPhone: string | null = null;
  if (isOwner) {
    const { data: priv } = await supabase
      .from("profiles_private")
      .select("phone")
      .eq("profile_id", id)
      .maybeSingle();
    ownPhone = priv?.phone?.trim() || null;
  }

  // Anuncios ativos do vendedor, com filtros aplicados.
  let query = supabase
    .from("products_with_split")
    .select(PRODUCT_COLS)
    .eq("seller_id", id)
    .eq("status", "ativo");

  if (categoria) query = query.eq("category", categoria);
  if (uf) query = query.eq("region_uf", uf);
  if (q && q.trim()) query = query.ilike("title", `%${q.trim()}%`);

  query = query.order("created_at", { ascending: ordenar === "antigos" });

  const { data: products } = await query.limit(60);
  const list = (products ?? []) as ProductRow[];

  // Total de anuncios ativos (sem filtro) para o "X de Y".
  const { count: totalActive } = await supabase
    .from("products_with_split")
    .select("id", { count: "exact", head: true })
    .eq("seller_id", id)
    .eq("status", "ativo");

  // Historico: anuncios ativos publicados nos ultimos 180 dias.
  const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
  const { count: last180 } = await supabase
    .from("products_with_split")
    .select("id", { count: "exact", head: true })
    .eq("seller_id", id)
    .eq("status", "ativo")
    .gte("created_at", since);

  const total = totalActive ?? list.length;
  const historico = last180 ?? 0;

  const verified = seller.account_status === "ativa";
  const memberSince = new Date(seller.created_at).getFullYear();
  const local = [seller.city, seller.region_uf].filter(Boolean).join(" - ");
  const initial = seller.full_name?.trim().charAt(0).toUpperCase() || "?";
  const firstName = seller.full_name?.trim().split(/\s+/)[0] || "Vendedor";
  const avatar = seller.avatar_url || null;
  const pres = presence(seller.last_seen_at);

  // Checklist de verificacao. E-mail e telefone so podem ser confirmados para o
  // proprio dono (PII / confirmacao de auth nao sao publicas). "Identidade
  // verificada" deriva de account_status e e publica.
  const emailConfirmed = isOwner ? Boolean(user?.email_confirmed_at) : null;
  const phoneConfirmed = isOwner ? Boolean(ownPhone) : null;

  const hasFilter = Boolean(q?.trim() || categoria || uf);

  return (
    <main className="container mt-3 mb-3">
      <div className="profile-grid">
        {/* ---------- Coluna lateral: identidade da loja ---------- */}
        <aside className="stack">
          <div className="card center">
            <div
              className="store-avatar"
              style={avatar ? { backgroundImage: `url(${avatar})` } : undefined}
            >
              {!avatar && initial}
            </div>

            {verified && (
              <span className="badge badge-primary mt-2">✓ Conta verificada</span>
            )}

            <h1 style={{ fontSize: "1.4rem", marginTop: "0.6rem", marginBottom: "0.2rem" }}>
              {firstName}
            </h1>

            {pres && (
              <div className="row" style={{ justifyContent: "center", gap: "0.4rem" }}>
                <span className={`presence-dot ${pres.online ? "" : "off"}`} />
                <span className="small muted">{pres.label}</span>
              </div>
            )}

            {rep?.ratings_count ? (
              <div className="mt-1 small">
                <span style={{ color: "var(--accent)" }}>★</span>{" "}
                <strong>{Number(rep.avg_score).toFixed(1)}</strong>{" "}
                <span className="muted">({rep.ratings_count} avaliacoes)</span>
              </div>
            ) : (
              <div className="mt-1 small muted">Sem avaliacoes ainda</div>
            )}

            <p className="muted small mt-2" style={{ marginBottom: 0 }}>
              No Partilhou desde {memberSince}
            </p>
            {local && (
              <p className="muted small" style={{ margin: 0 }}>
                📍 {local}
              </p>
            )}

            {isOwner && (
              <Link href="/perfil" className="btn btn-ghost btn-sm btn-block mt-2">
                Editar perfil
              </Link>
            )}
          </div>

          {/* Nivel de cadastro / verificacoes */}
          <div className="card">
            <h3 style={{ fontSize: "1rem" }}>Nivel de cadastro</h3>
            <p className="muted small">
              {verified ? "Informacoes da conta confirmadas." : "Conta em verificacao."}
            </p>

            <ul className="verify-list">
              <li className="verify-item">
                <span className={`verify-check ${verified ? "on" : ""}`}>
                  {verified ? "✓" : "•"}
                </span>
                <span>Identidade verificada</span>
              </li>

              {isOwner && (
                <>
                  <li className="verify-item">
                    <span className={`verify-check ${emailConfirmed ? "on" : ""}`}>
                      {emailConfirmed ? "✓" : "•"}
                    </span>
                    <span>Endereco de e-mail</span>
                  </li>
                  <li className="verify-item">
                    <span className={`verify-check ${phoneConfirmed ? "on" : ""}`}>
                      {phoneConfirmed ? "✓" : "•"}
                    </span>
                    <span>Numero de telefone</span>
                    {!phoneConfirmed && (
                      <Link
                        href="/perfil"
                        className="btn btn-ghost btn-sm"
                        style={{ marginLeft: "auto" }}
                      >
                        Adicionar
                      </Link>
                    )}
                  </li>
                </>
              )}
            </ul>

            {!isOwner && (
              <p className="muted small mt-1" style={{ marginBottom: 0 }}>
                Verificacoes de e-mail e telefone sao privadas do vendedor.
              </p>
            )}

            {!verified && isOwner && (
              <Link href="/perfil" className="btn btn-primary btn-block mt-2">
                Concluir verificacao
              </Link>
            )}
          </div>

          {/* Historico */}
          <div className="card">
            <h3 style={{ fontSize: "1rem", marginBottom: "0.25rem" }}>Historico</h3>
            <div style={{ fontSize: "2rem", fontWeight: 800, lineHeight: 1 }}>
              {historico}
            </div>
            <div className="muted small">anuncios</div>
            <p className="muted small mt-1" style={{ marginBottom: 0 }}>
              Publicados nos ultimos 180 dias
            </p>
          </div>
        </aside>

        {/* ---------- Coluna principal: anuncios ---------- */}
        <section className="stack">
          <div className="row between wrap">
            <h2 style={{ margin: 0 }}>Anuncios</h2>
            <span className="muted small">
              {list.length} de {total} anuncios publicados
            </span>
          </div>

          {/* Filtros (form GET — funciona sem JS) */}
          <form className="card store-filters" method="get">
            <div className="field" style={{ marginBottom: 0, flex: "1 1 220px" }}>
              <input
                className="input"
                type="text"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Ex: Iphone 11"
              />
            </div>
            <div className="field" style={{ marginBottom: 0, flex: "1 1 160px" }}>
              <label>Categoria</label>
              <select name="categoria" defaultValue={categoria ?? ""}>
                <option value="">Selecionar</option>
                {CATEGORIES.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.icon} {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0, flex: "1 1 120px" }}>
              <label>Localizacao</label>
              <select name="uf" defaultValue={uf ?? ""}>
                <option value="">Selecionar</option>
                {UFS.map((u) => (
                  <option key={u.uf} value={u.uf}>
                    {u.uf} — {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0, flex: "1 1 150px" }}>
              <label>Ordenar por</label>
              <select name="ordenar" defaultValue={ordenar ?? "recentes"}>
                <option value="recentes">Mais recentes</option>
                <option value="antigos">Mais antigos</option>
              </select>
            </div>
            <div className="row" style={{ alignSelf: "flex-end", gap: "0.5rem" }}>
              <button type="submit" className="btn btn-primary">
                Filtrar
              </button>
              {hasFilter && (
                <Link href={`/loja/${id}`} className="btn btn-ghost">
                  Limpar
                </Link>
              )}
            </div>
          </form>

          {list.length === 0 ? (
            <div className="card empty">
              {hasFilter
                ? "Nenhum anuncio encontrado com esses filtros."
                : "Esta loja ainda nao tem anuncios ativos."}
            </div>
          ) : (
            <div className="grid grid-products">
              {list.map((p) => (
                <ProductCard key={p.id} p={p} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ---------- Rodape ---------- */}
      <footer className="store-footer mt-3">
        <div className="store-footer-cols">
          <div>
            <strong>Sobre a Partilhou</strong>
            <Link href="/">Vender na Partilhou</Link>
            <Link href="/vender">Plano profissional</Link>
          </div>
          <div>
            <strong>Ajuda</strong>
            <Link href="/">Dicas de seguranca</Link>
            <Link href="/">Mapa do site</Link>
          </div>
          <div>
            <strong>Legal</strong>
            <Link href="/">Termos de uso</Link>
            <Link href="/">Politica de privacidade</Link>
            <Link href="/">Propriedade intelectual</Link>
          </div>
          <div>
            <strong>Partilhou</strong>
            <a href="#">Instagram</a>
            <a href="#">TikTok</a>
            <a href="#">YouTube</a>
          </div>
        </div>
        <p className="muted small center" style={{ marginTop: "1rem", marginBottom: 0 }}>
          © {new Date().getFullYear()} Partilhou — Marketplace C2C com afiliacao.
        </p>
      </footer>
    </main>
  );
}
