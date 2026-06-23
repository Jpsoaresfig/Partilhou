import Link from "next/link";

/** Rodape global: marca, navegacao, e os links legais / de suporte. */
export default function SiteFooter({ showGroups = false }: { showGroups?: boolean }) {
  const year = 2026;
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="foot-cols">
          <div>
            <div className="foot-brand">
              <span className="dot" /> Partilhou
            </div>
            <p className="muted small" style={{ maxWidth: 280 }}>
              Marketplace de produtos usados com afiliação e pagamento garantido
              por escrow. Compre, venda e indique com segurança.
            </p>
          </div>

          <div>
            <h4>Explorar</h4>
            <Link href="/">Início</Link>
            {showGroups && <Link href="/grupos">Grupos</Link>}
            <Link href="/vender">Anunciar produto</Link>
          </div>

          <div>
            <h4>Conta</h4>
            <Link href="/perfil">Perfil</Link>
            <Link href="/carteira">Carteira</Link>
            <Link href="/painel">Painel</Link>
          </div>

          <div>
            <h4>Ajuda &amp; Legal</h4>
            <Link href="/reportar">Reportar problema</Link>
            <Link href="/termos">Termos de Uso</Link>
            <Link href="/privacidade">Política de Privacidade</Link>
          </div>
        </div>

        <div className="foot-bottom">
          <span>© {year} Partilhou. Todos os direitos reservados.</span>
          <span>Vendas permitidas apenas para maiores de 18 anos.</span>
        </div>
      </div>
    </footer>
  );
}
