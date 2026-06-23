import Link from "next/link";

export const metadata = { title: "Política de Privacidade — Partilhou" };

export default function PrivacidadePage() {
  return (
    <main className="container mt-3 mb-3 legal">
      <h1>Política de Privacidade</h1>
      <p className="muted small">Última atualização: junho de 2026.</p>

      <p>
        Esta política explica como a Partilhou coleta, usa e protege seus dados,
        em linha com a Lei Geral de Proteção de Dados (LGPD).
      </p>

      <h2>Como a Partilhou funciona</h2>
      <ul>
        <li>
          <strong>Intermediação de vendas:</strong> a Partilhou é uma plataforma que
          <em> intermedia</em> a compra e venda de eletrônicos usados entre pessoas.
          Não somos a vendedora dos produtos: conectamos donos de produtos, vendedores
          e compradores, e organizamos o pagamento.
        </li>
        <li>
          <strong>Validação de produtos:</strong> cada anúncio passa por uma
          classificação de confiança (fotos, descrição estruturada e, quando aplicável,
          IMEI), exibida como selo e <em>trust score</em>. A validação <em>classifica</em> a
          confiança do anúncio; ela ajuda a orientar a decisão, mas não garante o estado
          do produto.
        </li>
        <li>
          <strong>Pagamento intermediado (escrow):</strong> o valor pago pelo comprador
          fica retido pela plataforma e só é repassado após a confirmação da entrega,
          reduzindo o risco de calote dos dois lados.
        </li>
        <li>
          <strong>Uso dos dados:</strong> seus dados são usados apenas para operar o
          sistema (anúncios, validação, pagamento, repasse e suporte) — não para outras
          finalidades alheias ao serviço.
        </li>
        <li>
          <strong>Redução, não eliminação de risco:</strong> validação e escrow
          <em> reduzem</em> o risco de fraude, mas nenhum sistema o elimina por completo.
          Use o bom senso e prefira sempre concluir a transação dentro da plataforma.
        </li>
      </ul>

      <h2>1. Dados que coletamos</h2>
      <ul>
        <li>
          <strong>Cadastro:</strong> nome, e-mail, telefone e, quando informado,
          CPF/CNPJ (necessário para repasses).
        </li>
        <li>
          <strong>Uso:</strong> anúncios, pedidos, mensagens de chat e
          notificações geradas pela sua atividade.
        </li>
        <li>
          <strong>Pagamentos:</strong> dados processados por parceiros de
          pagamento; não armazenamos os dados completos do cartão.
        </li>
      </ul>

      <h2>2. Como usamos seus dados</h2>
      <ul>
        <li>Operar o marketplace: anúncios, vendas, escrow e repasses.</li>
        <li>Prevenir fraudes e garantir a segurança da plataforma.</li>
        <li>Enviar notificações sobre seus pedidos e sua conta.</li>
      </ul>

      <h2>3. Compartilhamento</h2>
      <p>
        Compartilhamos dados apenas com o necessário para operar o serviço (ex:
        processadores de pagamento e transportadoras) ou quando exigido por lei.
        Não vendemos seus dados.
      </p>

      <h2>4. Seus direitos</h2>
      <p>
        Você pode acessar, corrigir ou solicitar a exclusão dos seus dados, além
        de revogar consentimentos. Para exercer esses direitos, use a página{" "}
        <Link href="/reportar">Reportar problema</Link>.
      </p>

      <h2>5. Segurança</h2>
      <p>
        Usamos criptografia em trânsito, controle de acesso por linha (RLS) e boas
        práticas para proteger seus dados. Nenhum sistema é 100% imune, mas
        trabalhamos continuamente para reduzir riscos.
      </p>

      <h2>6. Menores de idade</h2>
      <p>
        A plataforma é destinada a maiores de 18 anos. Não coletamos
        intencionalmente dados de menores.
      </p>

      <h2>7. Contato</h2>
      <p>
        Dúvidas sobre privacidade? Fale com a gente em{" "}
        <Link href="/reportar">Reportar problema</Link>.
      </p>

      <p className="muted small mt-3">
        Este documento é um modelo informativo e não substitui orientação
        jurídica.
      </p>
    </main>
  );
}
