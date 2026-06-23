/**
 * Feature flags do sistema, guardadas em `platform_settings` (key/value texto).
 *
 * platform_settings tem SELECT publico (RLS), entao pode ser lido pelo cliente
 * de servidor normal. A escrita e feita pelo painel admin via service_role.
 */
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Le uma flag booleana. Ausente => `fallback`. Memoizada por request (e por
 * chave) para nao repetir a consulta. value 'true'/'1' = ligado.
 */
export const getBoolFlag = cache(
  async (key: string, fallback = false): Promise<boolean> => {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (!data) return fallback;
    return data.value === "true" || data.value === "1";
  },
);

/** A area de Grupos esta visivel? Padrao: oculta. */
export const groupsEnabled = () => getBoolFlag("groups_enabled", false);
