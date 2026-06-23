import Link from "next/link";
import { formatBRL, bpsToPercent } from "@/lib/money";
import { trustBadge } from "@/lib/trust";

export type ProductRow = {
  id: string;
  title: string;
  images: string[];
  amount_total_cents: number;
  commission_bps: number;
  commission_cents: number;
  review_status?: string;
  trust_score?: number;
};

export default function ProductCard({ p }: { p: ProductRow }) {
  const cover = p.images?.[0];
  const badge = trustBadge(p.review_status, p.trust_score);
  return (
    <Link href={`/produto/${p.id}`} className="card product-card">
      <div
        className="product-thumb"
        style={cover ? { backgroundImage: `url(${cover})` } : undefined}
      >
        {!cover && "📦"}
      </div>
      <div className="product-body">
        <div className="product-title">{p.title}</div>
        <span className={`badge ${badge.className}`} title={badge.title}>
          {badge.label}
        </span>
        <div className="price">{formatBRL(p.amount_total_cents)}</div>
        {p.commission_bps > 0 && (
          <span className="badge badge-accent">
            Afilie e ganhe {formatBRL(p.commission_cents)} ({bpsToPercent(p.commission_bps)}%)
          </span>
        )}
      </div>
    </Link>
  );
}
