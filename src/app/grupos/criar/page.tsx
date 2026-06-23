import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import { groupsEnabled } from "@/lib/flags";
import CreateGroupForm from "@/components/CreateGroupForm";

export const dynamic = "force-dynamic";

export const metadata = { title: "Criar grupo — Partilhou" };

export default async function CriarGrupoPage() {
  if (!(await groupsEnabled())) redirect("/");
  const { user } = await getServerUser();
  if (!user) redirect("/login");

  return (
    <main className="container" style={{ maxWidth: 620, paddingTop: "2.5rem" }}>
      <Link href="/grupos" className="muted small">← Voltar para os grupos</Link>
      <div className="card mt-2">
        <h1>Criar um grupo</h1>
        <p className="muted small mb-2">
          Monte uma comunidade para compartilhar promocoes, achados e anuncios.
          Voce entra como administrador.
        </p>
        <CreateGroupForm />
      </div>
    </main>
  );
}
