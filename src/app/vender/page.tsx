import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import SellForm from "@/components/SellForm";

export const dynamic = "force-dynamic";

export default async function VenderPage() {
  const { user } = await getServerUser();
  if (!user) redirect("/login");

  // Apenas maiores de 18 anos podem anunciar. A declaracao e feita no cadastro
  // (user_metadata.is_adult). Contas antigas, sem o campo, continuam liberadas;
  // bloqueamos somente quem foi explicitamente marcado como menor.
  const isMinor = user.user_metadata?.is_adult === false;
  if (isMinor) {
    return (
      <main className="container mt-3 mb-3" style={{ maxWidth: 560 }}>
        <div className="card">
          <h1>Venda disponível apenas para maiores de 18 anos</h1>
          <p className="muted">
            Para anunciar na Partilhou é necessário confirmar que você tem 18 anos
            ou mais. Se você já é maior de idade, atualize seu perfil ou fale com o
            suporte.
          </p>
          <a className="btn btn-primary mt-1" href="/perfil">Ir para o perfil</a>
        </div>
      </main>
    );
  }

  return <SellForm />;
}
