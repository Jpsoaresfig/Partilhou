/**
 * POST /api/admin/settings  — atualiza uma chave de platform_settings.
 *
 * Restrito a admins. So aceita chaves de uma allowlist (evita escrita arbitraria).
 * O valor e sempre texto; a interpretacao (bool/int) fica com quem le.
 */
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ok, fail, handleError, readJson } from "@/lib/http";
import { z } from "zod";

// Chaves que o painel admin pode editar.
const EDITABLE = new Set([
  "groups_enabled",
  "platform_fee_bps",
  "min_commission_bps",
  "max_commission_bps",
  "escrow_auto_release_days",
  "affiliate_cookie_days",
]);

const schema = z.object({
  key: z.string().min(1),
  value: z.string().max(200),
});

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const { key, value } = schema.parse(await readJson(req));
    if (!EDITABLE.has(key)) return fail("Configuracao nao editavel", 422);

    // Upsert: funciona mesmo se a chave ainda nao foi semeada por migration.
    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from("platform_settings")
      .upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );

    if (error) throw error;
    return ok({ key, value });
  } catch (err) {
    return handleError(err);
  }
}
