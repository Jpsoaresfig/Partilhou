import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ProfileForm from "@/components/ProfileForm";

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: priv }, { data: payout }] = await Promise.all([
    supabase.from("profiles").select("full_name, avatar_url, city, region_uf").eq("id", user.id).maybeSingle(),
    supabase.from("profiles_private").select("document_number, phone, birth_year").eq("profile_id", user.id).maybeSingle(),
    supabase.from("wallet_payout_methods").select("pix_key").eq("user_id", user.id).maybeSingle(),
  ]);

  return (
    <main className="container mt-3 mb-3" style={{ maxWidth: 620 }}>
      <div className="row between wrap mb-2">
        <h1 style={{ margin: 0 }}>Meu perfil</h1>
        <Link href={`/loja/${user.id}`} className="btn btn-ghost btn-sm">
          Ver minha loja
        </Link>
      </div>
      <p className="muted mb-3">Dados usados para repasses e contato.</p>
      <ProfileForm
        userId={user.id}
        email={user.email ?? ""}
        initial={{
          full_name: profile?.full_name ?? "",
          avatar_url: profile?.avatar_url ?? "",
          document_number: priv?.document_number ?? "",
          phone: priv?.phone ?? "",
          city: profile?.city ?? "",
          region_uf: profile?.region_uf ?? "",
          birth_year: priv?.birth_year ? String(priv.birth_year) : "",
          pix_key: payout?.pix_key ?? "",
        }}
      />
    </main>
  );
}
