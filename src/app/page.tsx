import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ProductCard, { type ProductRow } from "@/components/ProductCard";
import { CATEGORIES } from "@/lib/categories";
import { UFS } from "@/lib/regions";
import { toCents } from "@/lib/money";

export const dynamic = "force-dynamic";

type Search = {
  q?: string;
  categoria?: string;
  uf?: string;
  preco_min?: string;
  preco_max?: string;
  ordenar?: string;
};

const PRODUCT_COLS =
  "id, title, images, amount_total_cents, commission_bps, commission_cents, category, region_uf, created_at";

/** Converte reais (string do form) em centavos; ignora valores invalidos. */
function reaisToCents(v?: string): number | null {
  if (!v || !v.trim()) return null;
  try {
    return toCents(v.trim());
  } catch {
    return null;
  }
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { q, categoria, uf, preco_min, preco_max, ordenar } = await searchParams;

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("products_with_split")
    .select(PRODUCT_COLS)
    .eq("status", "ativo");

  if (categoria) query = query.eq("category", categoria);
  if (uf) query = query.eq("region_uf", uf);
  if (q && q.trim()) query = query.ilike("title", `%${q.trim()}%`);

  const minCents = reaisToCents(preco_min);
  const maxCents = reaisToCents(preco_max);
  if (minCents != null) query = query.gte("amount_total_cents", minCents);
  if (maxCents != null) query = query.lte("amount_total_cents", maxCents);

  switch (ordenar) {
    case "antigos":
      query = query.order("created_at", { ascending: true });
      break;
    case "barato":
      query = query.order("amount_total_cents", { ascending: true });
      break;
    case "caro":
      query = query.order("amount_total_cents", { ascending: false });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  const { data: products } = await query.limit(48);
  const list = (products ?? []) as ProductRow[];

  const hasFilter = Boolean(
    q?.trim() || categoria || uf || preco_min?.trim() || preco_max?.trim(),
  );

  return (
    <main>
      <section className="container hero">
        <span className="badge badge-primary mb-2">Pagamento garantido por escrow</span>
        <h1>
          Compre, venda e <span className="gradient">indique</span> produtos usados
        </h1>
        <p className="lead">
          O vendedor define a comissao, o afiliado divulga e todos recebem com
          seguranca. A Partilhou retem o pagamento ate a entrega ser confirmada.
        </p>
        <div className="row" style={{ justifyContent: "center" }}>
          <Link href="/vender" className="btn btn-primary">
            Anunciar produto
          </Link>
          <Link href="/registrar" className="btn btn-ghost">
            Comecar a afiliar
          </Link>
        </div>
      </section>

      <section className="container mb-3">
        {/* Busca + filtros (form GET — funciona sem JS) */}
        <form className="card store-filters mb-2" method="get">
          <div className="field" style={{ marginBottom: 0, flex: "1 1 240px" }}>
            <label>Buscar</label>
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
              <option value="">Todas</option>
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.icon} {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0, flex: "1 1 120px" }}>
            <label>Regiao (UF)</label>
            <select name="uf" defaultValue={uf ?? ""}>
              <option value="">Todas</option>
              {UFS.map((u) => (
                <option key={u.uf} value={u.uf}>
                  {u.uf} — {u.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0, flex: "0 1 110px" }}>
            <label>Preco min</label>
            <input
              className="input"
              type="text"
              name="preco_min"
              inputMode="decimal"
              defaultValue={preco_min ?? ""}
              placeholder="0"
            />
          </div>
          <div className="field" style={{ marginBottom: 0, flex: "0 1 110px" }}>
            <label>Preco max</label>
            <input
              className="input"
              type="text"
              name="preco_max"
              inputMode="decimal"
              defaultValue={preco_max ?? ""}
              placeholder="∞"
            />
          </div>
          <div className="field" style={{ marginBottom: 0, flex: "1 1 150px" }}>
            <label>Ordenar por</label>
            <select name="ordenar" defaultValue={ordenar ?? "recentes"}>
              <option value="recentes">Mais recentes</option>
              <option value="antigos">Mais antigos</option>
              <option value="barato">Menor preco</option>
              <option value="caro">Maior preco</option>
            </select>
          </div>
          <div className="row" style={{ alignSelf: "flex-end", gap: "0.5rem" }}>
            <button type="submit" className="btn btn-primary">
              Filtrar
            </button>
            {hasFilter && (
              <Link href="/" className="btn btn-ghost">
                Limpar
              </Link>
            )}
          </div>
        </form>

        <div className="row between mb-2">
          <h2 style={{ margin: 0 }}>
            {hasFilter ? "Resultados" : "Anuncios em destaque"}
          </h2>
          <span className="muted small">{list.length} anuncios</span>
        </div>

        {list.length === 0 ? (
          <div className="card empty">
            {hasFilter ? (
              "Nenhum anuncio encontrado com esses filtros."
            ) : (
              <>
                Nenhum anuncio ativo ainda. Seja o primeiro a{" "}
                <Link href="/vender" style={{ color: "var(--primary)" }}>
                  anunciar
                </Link>
                .
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-products">
            {list.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
