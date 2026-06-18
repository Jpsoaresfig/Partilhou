import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  formatBRL,
  bpsToPercent,
  resolveCommissionBps,
  affiliateEffectivePrice,
} from "@/lib/money";
import { describeAttributes } from "@/lib/categories";
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

  // ----- Faixa de preco e comissao variavel -----
  const targetCents: number = product.amount_total_cents;
  const floorCents: number | null = product.min_price_cents ?? null;
  const hasRange = floorCents != null && floorCents < targetCents;

  // Se o comprador chegou por um link de afiliado (?ref=), resolve o preco que
  // ESTE afiliado escolheu — e o que sera cobrado no checkout. O link so e
  // legivel pelo dono (RLS); aqui lemos via service_role pois o preco do ref e
  // publico (e o anunciado). Falha silenciosa => exibe a faixa padrao.
  let refPrice: { priceCents: number; commissionCents: number; bps: number } | null = null;
  if (ref) {
    const admin = createSupabaseAdminClient();
    const { data: link } = await admin
      .from("affiliate_links")
      .select("sale_price_cents")
      .eq("tracking_code", ref)
      .eq("product_id", id)
      .maybeSingle();
    if (link) {
      const priceCents = affiliateEffectivePrice(link.sale_price_cents ?? null, targetCents, floorCents);
      const bps = resolveCommissionBps({
        saleCents: priceCents,
        targetCents,
        floorCents,
        commissionBps: product.commission_bps,
        commissionMinBps: product.commission_min_bps ?? null,
        model: product.commission_model ?? "linear",
        tiers: product.commission_tiers ?? null,
      });
      refPrice = { priceCents, bps, commissionCents: Math.floor((priceCents * bps) / 10000) };
    }
  }

  const priceText = refPrice
    ? formatBRL(refPrice.priceCents)
    : hasRange
      ? `${formatBRL(floorCents)} – ${formatBRL(targetCents)}`
      : formatBRL(targetCents);

  const { rows: detailRows, opcionais, category } = describeAttributes(
    product.category,
    product.attributes,
  );
  // Primeiros atributos preenchidos viram um resumo rapido abaixo do titulo.
  const highlights = detailRows.slice(0, 3);

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
      <div className="product-grid">
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
            <span className="badge mb-2">{category.icon} {category.label}</span>
            <h1 style={{ fontSize: "1.5rem" }}>{product.title}</h1>
            <div className="price mb-2">{priceText}</div>
            {hasRange && !refPrice && (
              <p className="small muted" style={{ marginTop: -6 }}>
                Faixa de venda — o afiliado escolhe o valor dentro dela.
              </p>
            )}

            {highlights.length > 0 && (
              <div className="row wrap mb-2" style={{ gap: "0.5rem" }}>
                {highlights.map((h) => (
                  <span key={h.label} className="chip" title={h.label}>
                    {h.value}
                  </span>
                ))}
              </div>
            )}

            <p className="muted small">
              Vendido por{" "}
              <Link href={`/loja/${product.seller_id}`} style={{ color: "var(--primary)" }}>
                {seller?.full_name ?? "Vendedor"}
              </Link>
            </p>

            {refPrice ? (
              refPrice.bps > 0 && (
                <div className="split-box mt-1">
                  <div className="split-line">
                    <span>Comissao deste afiliado</span>
                    <strong className="badge badge-accent">
                      {formatBRL(refPrice.commissionCents)} · {bpsToPercent(refPrice.bps)}%
                    </strong>
                  </div>
                </div>
              )
            ) : hasRange ? (
              <div className="split-box mt-1">
                <div className="split-line">
                  <span>Comissao do afiliado</span>
                  <strong className="badge badge-accent">
                    {bpsToPercent(product.floor_commission_bps)}% → {bpsToPercent(product.effective_commission_bps)}%
                  </strong>
                </div>
                <div className="small muted">Quanto mais caro o afiliado vender, maior a comissao.</div>
              </div>
            ) : (
              product.commission_bps > 0 && (
                <div className="split-box mt-1">
                  <div className="split-line">
                    <span>Comissao de afiliado</span>
                    <strong className="badge badge-accent">
                      {formatBRL(product.commission_cents)} · {bpsToPercent(product.commission_bps)}%
                    </strong>
                  </div>
                </div>
              )
            )}

            <div className="mt-2">
              <ProductActions
                productId={product.id}
                authed={!!user}
                isSeller={isSeller}
                affiliateCode={ref}
                buyerName={buyerName}
                pricing={{
                  minPriceCents: floorCents,
                  targetPriceCents: targetCents,
                  commissionBps: product.commission_bps,
                  commissionMinBps: product.commission_min_bps ?? null,
                  commissionModel: product.commission_model ?? "linear",
                  commissionTiers: product.commission_tiers ?? null,
                  platformFeeBps: product.platform_fee_bps,
                }}
              />
            </div>
          </div>

          {product.description && (
            <div className="card">
              <h3>Descricao</h3>
              <p className="muted" style={{ whiteSpace: "pre-wrap" }}>{product.description}</p>
            </div>
          )}

          {(detailRows.length > 0 || opcionais.length > 0) && (
            <div className="card">
              <h3>Detalhes</h3>

              {detailRows.length > 0 && (
                <dl className="detail-list">
                  {detailRows.map((row) => (
                    <div className="detail-item" key={row.label}>
                      <dt className="detail-k">{row.label}</dt>
                      <dd className="detail-v">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {opcionais.length > 0 && (
                <>
                  <h4 className="muted small mt-2" style={{ textTransform: "uppercase", letterSpacing: "0.03em" }}>
                    Opcionais
                  </h4>
                  <div className="row wrap mt-1" style={{ gap: "0.5rem" }}>
                    {opcionais.map((opt) => (
                      <span key={opt} className="chip">✓ {opt}</span>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
