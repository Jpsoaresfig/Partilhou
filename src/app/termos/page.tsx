import Link from "next/link";

export const metadata = { title: "Termos de Uso — Partilhou" };

export default function TermosPage() {
  return (
    <main className="container mt-3 mb-3 legal">
      <h1>Termos de Uso</h1>
      <p className="muted small">Última atualização: junho de 2026.</p>

      <p>
        Bem-vindo à Partilhou. Ao criar uma conta ou usar a plataforma, você
        concorda com estes Termos de Uso e com a nossa{" "}
        <Link href="/privacidade">Política de Privacidade</Link>. Leia com
        atenção.
      </p>

      <h2>1. O que é a Partilhou</h2>
      <p>
        A Partilhou é um marketplace que conecta vendedores, compradores e
        afiliados de produtos usados. O pagamento fica retido (escrow) até a
        confirmação da entrega, protegendo as partes.
      </p>

      <h2>2. Idade mínima</h2>
      <p>
        É necessário ter <strong>18 anos ou mais</strong> para criar uma conta e
        anunciar/vender produtos na plataforma. Ao se cadastrar, você declara ser
        maior de idade. Contas que descumprirem este requisito podem ser
        suspensas.
      </p>

      <h2>3. Conta e responsabilidades</h2>
      <ul>
        <li>Você é responsável por manter seus dados de acesso em segurança.</li>
        <li>As informações fornecidas devem ser verdadeiras e atualizadas.</li>
        <li>É proibido anunciar itens ilegais, falsificados ou perigosos.</li>
      </ul>

      <h2>4. Vendas, comissões e afiliação</h2>
      <p>
        O vendedor define o preço e a comissão do afiliado. A Partilhou pode reter
        uma taxa de serviço sobre cada venda concluída. Os valores ficam retidos
        até a confirmação da entrega e então são liberados para saque.
      </p>

      <h2>5. Pagamentos e escrow</h2>
      <p>
        Os pagamentos são processados por parceiros e mantidos em custódia até a
        entrega. Em caso de disputa, a Partilhou pode reter, liberar ou estornar
        os valores conforme análise.
      </p>

      <h2>6. Conduta proibida</h2>
      <ul>
        <li>Fraudes, golpes ou tentativas de burlar o escrow.</li>
        <li>Assédio, discurso de ódio ou conteúdo impróprio.</li>
        <li>Uso da plataforma para fins ilícitos.</li>
      </ul>

      <h2>7. Encerramento</h2>
      <p>
        Podemos suspender ou encerrar contas que violem estes termos. Você pode
        encerrar sua conta a qualquer momento.
      </p>

      <h2>8. Contato</h2>
      <p>
        Dúvidas ou problemas? Use a página{" "}
        <Link href="/reportar">Reportar problema</Link>.
      </p>

      <p className="muted small mt-3">
        Este documento é um modelo informativo e não substitui orientação
        jurídica.
      </p>
    </main>
  );
}
