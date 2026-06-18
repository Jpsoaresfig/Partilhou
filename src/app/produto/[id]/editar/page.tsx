import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import EditProductForm from "@/components/EditProductForm";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: product } = await supabase
    .from("products")
    .select(
      "id, seller_id, title, description, images, amount_total_cents, min_price_cents, commission_bps, commission_min_bps, commission_model, commission_tiers, status, category, attributes",
    )
    .eq("id", id)
    .maybeSingle();

  if (!product) notFound();
  if (product.seller_id !== user.id) redirect(`/produto/${id}`);

  return <EditProductForm product={product} />;
}
