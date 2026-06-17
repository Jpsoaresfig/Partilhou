/**
 * GET /api/orders?role=comprador|vendedor|afiliado
 * Lista os pedidos do usuario no papel indicado (RLS restringe aos envolvidos).
 */
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";

export async function GET(req: Request) {
  try {
    const { user, supabase } = await requireUser();
    const role = new URL(req.url).searchParams.get("role") ?? "comprador";

    const column =
      role === "vendedor" ? "seller_id" : role === "afiliado" ? "affiliate_id" : "buyer_id";

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq(column, user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return ok({ orders: data, role });
  } catch (err) {
    return handleError(err);
  }
}
