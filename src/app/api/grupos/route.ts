/**
 * POST /api/grupos  — cria um grupo (comunidade) com o usuario autenticado como
 * dono. O slug e derivado do nome; colisao de nome devolve 409. O dono entra
 * automaticamente como admin (trigger no banco). Insert respeita a RLS.
 */
import { requireUser } from "@/lib/auth";
import { ok, handleError, readJson } from "@/lib/http";
import { createGroupSchema } from "@/lib/validation";
import { slugify } from "@/lib/groups";

export async function POST(req: Request) {
  try {
    const { user, supabase } = await requireUser();
    const body = createGroupSchema.parse(await readJson(req));

    const { data, error } = await supabase
      .from("groups")
      .insert({
        slug: slugify(body.name),
        name: body.name,
        description: body.description ?? null,
        theme: body.theme,
        visibility: body.visibility,
        icon: body.icon ?? "📦",
        region_uf: body.region_uf ?? null,
        owner_id: user.id,
      })
      .select("id, slug")
      .single();

    if (error) throw error;
    return ok({ group: data }, 201);
  } catch (err) {
    return handleError(err);
  }
}
