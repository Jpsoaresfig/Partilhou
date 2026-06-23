import Link from "next/link";
import Icon, { type IconName } from "@/components/icons";

export const metadata = { title: "Por que a Partilhou é segura — Confiança" };

/** Um pilar de confianca (icone + titulo + texto). */
function Pillar({ icon, title, children }: { icon: IconName; title: string; children: React.ReactNode }) {
  return (
    <div className="card trust-pillar">
      <span className="trust-pillar-ico">
        <Icon name={icon} size={22} />
      </span>
      <h3>{title}</h3>
      <p className="muted small">{children}</p>
    </div>
  );
}

/** Como a Partilhou resolve cada dor do marketplace tradicional. */
const COMPARE: { problem: string; partilhou: string }[] = [
  {
    problem: "Negociação caótica e infinita pelo chat",
    partilhou: "O dono define o preço; quem vende é o afiliado. Sem pechincha tóxica.",
  },
  {
    problem: "“Chute” de preço e anúncios incompletos",
    partilhou: "Todo anúncio é classificado por confiança (fotos, descrição, IMEI).",
  },
  {
    problem: "Risco de golpe no pagamento (PIX adiantado)",
    partilhou: "Pagamento fica retido em escrow e só é liberado após a entrega.",
  },
  {
    problem: "Produto duplicado / aparelho roubado",
    partilhou: "IMEI estruturado e único entre anúncios vivos; moderação pode reprovar.",
  },
  {
    problem: "Comprador some e o vendedor não recebe",
    partilhou: "Liberação automática do valor após o prazo de entrega.",
  },
];

export default function ConfiancaPage() {
  return (
    <main>
      <section className="container mt-3">
        <div className="hero-card">
          <span className="badge mb-2">🛡️ Confiança em primeiro lugar</span>
          <h1>Comprar e vender sem cair em golpe</h1>
          <p className="lead">
            A Partilhou foi desenhada para tirar o risco da equação: produtos são
            validados antes de aparecer, o pagamento fica protegido até a entrega
            e ninguém precisa negociar no escuro.
          </p>
          <div className="row" style={{ gap: "0.5rem", marginTop: "1rem" }}>
            <Link href="/" className="btn btn-primary">
              <Icon name="search" size={17} /> Ver anúncios
            </Link>
            <Link href="/vendas-rapidas" className="btn btn-ghost">
              <Icon name="dollar" size={17} /> Vender e ganhar comissão
            </Link>
          </div>
        </div>
      </section>

      <section className="container mb-3 mt-3">
        <h2 className="mb-2">O que protege você</h2>
        <div className="grid trust-grid">
          <Pillar icon="shield" title="Validação de confiança">
            Todo anúncio é classificado por um checklist: quantidade de fotos,
            descrição estruturada e, em celulares, IMEI válido. Anúncios incompletos
            entram com selo baixo (não verificado); fraudes evidentes são reprovadas
            pela moderação e não podem ser vendidas.
          </Pillar>
          <Pillar icon="wallet" title="Pagamento em escrow">
            O dinheiro do comprador fica retido pela plataforma e só é liberado ao
            vendedor depois que a entrega é confirmada. Sem entrega, sem liberação.
          </Pillar>
          <Pillar icon="users" title="Vendedores como força de vendas">
            O dono do produto não conversa com ninguém: afiliados verificados pegam
            o produto, vendem e ganham comissão. Menos atrito, menos golpe no chat.
          </Pillar>
          <Pillar icon="flag" title="Disputa e mediação">
            Algo deu errado? O comprador abre disputa e os valores são congelados
            até a mediação decidir liberar ou estornar. O dinheiro nunca some.
          </Pillar>
          <Pillar icon="store" title="Selo de confiança visível">
            Cada anúncio mostra um selo (Verificado / Parcial / Não verificado) e
            uma nota de 0 a 100, para você comprar sabendo o nível de validação.
          </Pillar>
          <Pillar icon="bell" title="Tudo rastreado">
            Cada etapa — pagamento, envio, entrega, liberação — gera notificação e
            fica registrada. Nada acontece sem deixar rastro.
          </Pillar>
        </div>
      </section>

      <section className="container mb-3">
        <h2 className="mb-2">Por que é melhor que OLX e Facebook Marketplace</h2>
        <div className="card compare-card">
          <table className="compare-table">
            <thead>
              <tr>
                <th>No marketplace comum</th>
                <th>Na Partilhou</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((row) => (
                <tr key={row.problem}>
                  <td className="compare-bad">✕ {row.problem}</td>
                  <td className="compare-good">✓ {row.partilhou}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="container mb-3">
        <div className="card trust-cta">
          <h2>Pronto para começar?</h2>
          <p className="muted">
            Anuncie um produto e deixe a força de vendas trabalhar por você — ou
            comece a vender produtos validados e ganhe comissão.
          </p>
          <div className="row" style={{ gap: "0.5rem" }}>
            <Link href="/vender" className="btn btn-primary">
              <Icon name="plus" size={17} /> Anunciar produto
            </Link>
            <Link href="/vendas-rapidas" className="btn btn-ghost">
              <Icon name="dollar" size={17} /> Ver oportunidades de venda
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
