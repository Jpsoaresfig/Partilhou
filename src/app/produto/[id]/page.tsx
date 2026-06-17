import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatBRL, bpsToPercent } from "@/lib/money";
import ProductActions from "@/components/ProductActions";

export const dynamic = "force-dynamic";

type Params = { id: string };
type Search = { ref?: string };

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { id } = await params;
  const { ref } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: product } = await supabase
    .from("products_with_split")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!product) notFound();

  const { data: seller } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", product.seller_id)
    .maybeSingle();

  const images: string[] = product.images ?? [];
  const isSeller = user?.id === product.seller_id;

  let buyerName: string | undefined;
  if (user && !isSeller) {
    const { data: me } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    buyerName = me?.full_name ?? undefined;
  }

  return (
    <main className="container mt-3 mb-3">
      <div className="grid" style={{ gridTemplateColumns: "1.3fr 1fr", gap: "1.5rem" }}>
        {/* Galeria */}
        <div>
          <div
            className="card product-thumb"
            style={{
              aspectRatio: "4/3",
              ...(images[0] ? { backgroundImage: `url(${images[0]})` } : {}),
            }}
          >
            {!images[0] && <span style={{ fontSize: "4rem" }}>📦</span>}
          </div>
          {images.length > 1 && (
            <div className="row wrap mt-1">
              {images.slice(1, 5).map((img, i) => (
                <div
                  key={i}
                  className="product-thumb"
                  style={{
                    width: 90,
                    height: 70,
                    borderRadius: 8,
                    backgroundImage: `url(${img})`,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Info + acoes */}
        <div className="stack">
          <div className="card">
            <h1 style={{ fontSize: "1.5rem" }}>{product.title}</h1>
            <div className="price mb-2">{formatBRL(product.amount_total_cents)}</div>
            <p className="muted small">Vendido por {seller?.full_name ?? "Vendedor"}</p>

            {product.commission_bps > 0 && (
              <div className="split-box mt-1">
                <div className="split-line">
                  <span>Comissao de afiliado</span>
                  <strong className="badge badge-accent">
                    {formatBRL(product.commission_cents)} · {bpsToPercent(product.commission_bps)}%
                  </strong>
                </div>
              </div>
            )}

            <div className="mt-2">
              <ProductActions
                productId={product.id}
                authed={!!user}
                isSeller={isSeller}
                affiliateCode={ref}
                buyerName={buyerName}
              />
            </div>
          </div>

          {product.description && (
            <div className="card">
              <h3>Descricao</h3>
              <p className="muted" style={{ whiteSpace: "pre-wrap" }}>{product.description}</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
