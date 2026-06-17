import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ProductCard, { type ProductRow } from "@/components/ProductCard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const { data: products } = await supabase
    .from("products_with_split")
    .select("id, title, images, amount_total_cents, commission_bps, commission_cents")
    .eq("status", "ativo")
    .order("created_at", { ascending: false })
    .limit(48);

  const list = (products ?? []) as ProductRow[];

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
        <div className="row between mb-2">
          <h2 style={{ margin: 0 }}>Anuncios em destaque</h2>
          <span className="muted small">{list.length} ativos</span>
        </div>

        {list.length === 0 ? (
          <div className="card empty">
            Nenhum anuncio ativo ainda. Seja o primeiro a{" "}
            <Link href="/vender" style={{ color: "var(--primary)" }}>
              anunciar
            </Link>
            .
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
