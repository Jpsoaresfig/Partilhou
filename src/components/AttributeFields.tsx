"use client";

import { CATEGORIES, getCategory } from "@/lib/categories";

/**
 * Seletor de categoria + campos estruturados dinamicos do anuncio.
 * Reutilizado no cadastro (SellForm) e na edicao (EditProductForm).
 *
 * O estado e mantido pelo formulario pai: um slug de categoria, um mapa de
 * atributos (chave -> string) e a lista de opcionais marcados.
 */
export default function AttributeFields({
  category,
  attrs,
  opcionais,
  onCategory,
  onAttrs,
  onOpcionais,
}: {
  category: string;
  attrs: Record<string, string>;
  opcionais: string[];
  onCategory: (slug: string) => void;
  onAttrs: (attrs: Record<string, string>) => void;
  onOpcionais: (opts: string[]) => void;
}) {
  const def = getCategory(category);

  function setField(key: string, value: string) {
    onAttrs({ ...attrs, [key]: value });
  }

  function toggleOpcional(opt: string) {
    onOpcionais(
      opcionais.includes(opt)
        ? opcionais.filter((o) => o !== opt)
        : [...opcionais, opt],
    );
  }

  return (
    <>
      <div className="field">
        <label>Categoria</label>
        <select value={category} onChange={(e) => onCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.icon} {c.label}
            </option>
          ))}
        </select>
      </div>

      {def.fields.length > 0 && (
        <div className="row wrap" style={{ alignItems: "flex-start" }}>
          {def.fields.map((f) => (
            <div className="field" key={f.key} style={{ flex: 1, minWidth: 180 }}>
              <label>
                {f.label}
                {f.unit ? ` (${f.unit})` : ""}
              </label>
              {f.type === "select" ? (
                <select
                  value={attrs[f.key] ?? ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                >
                  <option value="">Selecione</option>
                  {f.options?.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="input"
                  inputMode={f.type === "number" ? "numeric" : "text"}
                  value={attrs[f.key] ?? ""}
                  placeholder={f.placeholder}
                  onChange={(e) => setField(f.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {def.opcionais && def.opcionais.length > 0 && (
        <div className="field">
          <label>Opcionais e caracteristicas</label>
          <div className="row wrap" style={{ gap: "0.5rem" }}>
            {def.opcionais.map((opt) => {
              const active = opcionais.includes(opt);
              return (
                <button
                  type="button"
                  key={opt}
                  className={`chip-toggle${active ? " active" : ""}`}
                  onClick={() => toggleOpcional(opt)}
                  aria-pressed={active}
                >
                  {active ? "✓ " : ""}
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
