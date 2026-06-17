const MAP: Record<string, { label: string; cls: string }> = {
  // payment_status
  pendente: { label: "Pagamento pendente", cls: "badge-warn" },
  aprovado: { label: "Pago (retido)", cls: "badge-primary" },
  em_disputa: { label: "Em disputa", cls: "badge-danger" },
  estornado: { label: "Estornado", cls: "badge-danger" },
  concluido: { label: "Concluido", cls: "badge-primary" },
  // delivery_status
  aguardando_envio: { label: "Aguardando envio", cls: "badge-warn" },
  em_transito: { label: "Em transito", cls: "badge-accent" },
  entregue: { label: "Entregue", cls: "badge-primary" },
  // funds_state
  aguardando_pagamento: { label: "Aguardando pagamento", cls: "badge-warn" },
  retido: { label: "Retido (escrow)", cls: "badge-accent" },
  liberado: { label: "Liberado", cls: "badge-primary" },
};

export default function StatusBadge({ status }: { status: string }) {
  const item = MAP[status] ?? { label: status, cls: "" };
  return <span className={`badge ${item.cls}`}>{item.label}</span>;
}
