import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Icon from "@/components/icons";
import ProductCard, { type ProductRow } from "@/components/ProductCard";
import { formatBRL } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vendas Rápidas — Partilhou" };

// Colunas necessarias para o card + ranking de oportunidade.
const PRODUCT_COLS =
  "id, title, images, amount_total_cents, commission_bps, commission_cents, category, region_uf, review_status, trust_score, created_at";

/**
 * Painel "Vendas Rápidas": vitrine de OPORTUNIDADES para o afiliado/vendedor.
 *
 * Sao os anuncios mais faceis e mais lucrativos de vender AGORA:
 *   - ja VALIDADOS (review_status approved/partial) -> menos atrito, ja prontos;
 *   - com comissao ativa (commission_bps > 0) -> tem ganho para quem vende;
 *   - ordenados pela COMISSAO em reais (maior payout primeiro), desempatando por
 *     confianca (trust_score) -> "maior ganho + mais facil de fechar" no topo.
 *
 * Nao existe um campo explicito de "urgencia" no modelo; a urgencia e derivada
 * de forma honesta da comissao oferecida (quanto maior, mais o dono quer girar
 * o produto) combinada com o selo de validacao.
 */
export default async function VendasRapidasPage() {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("products_with_split")
    .select(PRODUCT_COLS)
    .eq("status", "ativo")
    .in("review_status", ["approved", "partial"]) // so produtos validados
    .gt("commission_bps", 0) // precisa pagar comissao a quem vende
    .order("commission_cents", { ascending: false })
    .order("trust_score", { ascending: false })
    .limit(48);

  const list = (data ?? []) as ProductRow[];

  // Resumo de incentivo: quanto ha "na mesa" em comissao nesta vitrine.
  const totalCommission = list.reduce((sum, p) => sum + (p.commission_cents ?? 0), 0);
  const topCommission = list[0]?.commission_cents ?? 0;

  return (
    <main>
      <section className="container mt-3">
        <div className="hero-card">
          <span className="badge mb-2">⚡ Oportunidades de venda</span>
          <h1>Vendas Rápidas</h1>
          <p className="lead">
            Produtos já validados e prontos para vender — você não precisa
            negociar com o dono, só fechar a venda e ganhar a comissão. Quanto
            maior o preço final, maior o seu ganho.
          </p>
          <div className="row" style={{ gap: "0.5rem", marginTop: "1rem" }}>
            <Link href="/registrar" className="btn btn-primary">
              <Icon name="users" size={17} /> Começar a afiliar
            </Link>
            <Link href="/confianca" className="btn btn-ghost">
              <Icon name="shield" size={17} /> Como funciona a segurança
            </Link>
          </div>
        </div>
      </section>

      {list.length > 0 && (
        <section className="container mb-2">
          <div className="grid fast-stats">
            <div className="card stat">
              <span className="stat-num">{list.length}</span>
              <span className="muted small">oportunidades abertas</span>
            </div>
            <div className="card stat">
              <span className="stat-num">{formatBRL(topCommission)}</span>
              <span className="muted small">maior comissão por venda</span>
            </div>
            <div className="card stat">
              <span className="stat-num">{formatBRL(totalCommission)}</span>
              <span className="muted small">total em comissões na vitrine</span>
            </div>
          </div>
        </section>
      )}

      <section className="container mb-3">
        <div className="row between mb-2">
          <h2 style={{ margin: 0 }}>Maiores comissões agora</h2>
          <Link href="/" className="muted small">
            Ver todos os anúncios →
          </Link>
        </div>

        {list.length === 0 ? (
          <div className="card empty">
            Ainda não há oportunidades de venda rápida. Assim que os vendedores
            publicarem produtos validados com comissão, eles aparecem aqui.{" "}
            <Link href="/vender" style={{ color: "var(--primary)" }}>
              Anuncie o primeiro
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
