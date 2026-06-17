/**
 * POST /api/admin/orders/:id/resolve  { outcome: "liberar" | "estornar" }
 * Mediacao da plataforma decide a disputa. Requer admin (flag em app_metadata).
 */
import { requireAdmin } from "@/lib/auth";
import { appRpc, createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ok, handleError, readJson } from "@/lib/http";
import { resolveDisputeSchema } from "@/lib/validation";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await requireAdmin();
    const body = resolveDisputeSchema.parse(await readJson(req));

    const { data, error } = await appRpc().rpc("resolve_dispute", {
      p_order_id: id,
      p_outcome: body.outcome,
    });
    if (error) throw error;

    // Se estornou, dispara o estorno real no gateway (best-effort; auditado).
    if (body.outcome === "estornar") {
      // TODO(producao): chamar a API de refund do gateway com o provider_payment_id.
      // O efeito contabil ja foi aplicado por refund_order; aqui falta o
      // movimento financeiro externo de devolucao ao comprador.
      void createSupabaseAdminClient();
    }

    return ok({ order: data });
  } catch (err) {
    return handleError(err);
  }
}
