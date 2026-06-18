/**
 * Exibicao de confiabilidade (estrelas + media) a partir de profile_reputation.
 * Presentacional — pode ser usado em Server Components.
 */

export type Rep = { avg_score: number | string; ratings_count: number } | null;

/** Estrelas preenchidas/vazias para uma media de 0..5. */
function Stars({ value }: { value: number }) {
  const full = Math.round(value);
  return (
    <span aria-hidden style={{ color: "var(--accent)", letterSpacing: 1 }}>
      {"★".repeat(full)}
      <span className="muted">{"★".repeat(Math.max(0, 5 - full))}</span>
    </span>
  );
}

export default function Reputation({
  rep,
  label,
  size = "md",
}: {
  rep: Rep;
  label?: string;
  size?: "sm" | "md";
}) {
  const count = rep?.ratings_count ?? 0;
  if (!rep || count === 0) {
    return (
      <span className={size === "sm" ? "small muted" : "muted"}>
        {label ? `${label}: ` : ""}Sem avaliacoes ainda
      </span>
    );
  }
  const avg = Number(rep.avg_score);
  return (
    <span className={size === "sm" ? "small" : ""}>
      {label && <span className="muted">{label}: </span>}
      <Stars value={avg} /> <strong>{avg.toFixed(1)}</strong>{" "}
      <span className="muted">({count})</span>
    </span>
  );
}
