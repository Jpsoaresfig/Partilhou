import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import SellForm from "@/components/SellForm";

export const dynamic = "force-dynamic";

export default async function VenderPage() {
  const { user } = await getServerUser();
  if (!user) redirect("/login");

  return <SellForm />;
}
