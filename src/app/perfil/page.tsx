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
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("profiles_private").select("document_number, phone").eq("profile_id", user.id).maybeSingle(),
    supabase.from("wallet_payout_methods").select("pix_key").eq("user_id", user.id).maybeSingle(),
  ]);

  return (
    <main className="container mt-3 mb-3" style={{ maxWidth: 620 }}>
      <h1>Meu perfil</h1>
      <p className="muted mb-3">Dados usados para repasses e contato.</p>
      <ProfileForm
        userId={user.id}
        initial={{
          full_name: profile?.full_name ?? "",
          document_number: priv?.document_number ?? "",
          phone: priv?.phone ?? "",
          pix_key: payout?.pix_key ?? "",
        }}
      />
    </main>
  );
}
