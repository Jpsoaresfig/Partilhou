/**
 * POST /api/admin/reports/:id/resolve  — muda o status de um reporte.
 *
 * Restrito a admins. problem_reports nao concede grants ao cliente, entao a
 * escrita usa service_role.
 */
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ok, fail, handleError, readJson } from "@/lib/http";
import { z } from "zod";

const schema = z.object({ status: z.enum(["aberto", "resolvido"]) });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const { status } = schema.parse(await readJson(req));

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("problem_reports")
      .update({ status })
      .eq("id", id)
      .select("id, status")
      .maybeSingle();

    if (error) throw error;
    if (!data) return fail("Reporte nao encontrado", 404);
    return ok({ report: data });
  } catch (err) {
    return handleError(err);
  }
}
