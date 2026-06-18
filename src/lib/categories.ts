/**
 * Definicao das categorias de anuncio e dos campos estruturados de cada uma.
 *
 * O banco guarda apenas `category` (slug) e `attributes` (jsonb chave/valor).
 * Toda a semantica — quais campos existem, rotulos, ordem de exibicao e
 * caracteristicas (opcionais) — vive aqui e e compartilhada pelo formulario de
 * cadastro e pela tela de detalhe do produto. Para suportar um novo tipo de
 * produto, basta acrescentar uma categoria nesta lista.
 */

export type AttrFieldType = "text" | "number" | "select";

export type AttrField = {
  /** chave salva em products.attributes */
  key: string;
  label: string;
  type: AttrFieldType;
  /** opcoes do <select> (apenas type === "select") */
  options?: string[];
  /** sufixo exibido junto ao valor, ex.: "km", "GB" */
  unit?: string;
  placeholder?: string;
};

export type Category = {
  slug: string;
  label: string;
  /** emoji usado como fallback de imagem / icone */
  icon: string;
  fields: AttrField[];
  /** caracteristicas booleanas — chips de multipla selecao */
  opcionais?: string[];
};

const ESTADO = ["Novo", "Seminovo", "Usado"];

export const CATEGORIES: Category[] = [
  {
    slug: "carros",
    label: "Carros, vans e utilitarios",
    icon: "🚗",
    fields: [
      { key: "marca", label: "Marca", type: "text", placeholder: "Chevrolet" },
      { key: "modelo", label: "Modelo", type: "text", placeholder: "Onix Joy Hatch 1.0" },
      { key: "ano", label: "Ano", type: "number", placeholder: "2018" },
      { key: "quilometragem", label: "Quilometragem", type: "number", unit: "km", placeholder: "45000" },
      { key: "potencia", label: "Potencia do motor", type: "text", placeholder: "1.0" },
      { key: "combustivel", label: "Combustivel", type: "select", options: ["Flex", "Gasolina", "Etanol", "Diesel", "GNV", "Hibrido", "Eletrico"] },
      { key: "cambio", label: "Cambio", type: "select", options: ["Manual", "Automatico", "Automatizado", "CVT"] },
      { key: "direcao", label: "Direcao", type: "select", options: ["Mecanica", "Hidraulica", "Eletrica", "Eletro-hidraulica"] },
      { key: "cor", label: "Cor", type: "text", placeholder: "Branco" },
      { key: "portas", label: "Portas", type: "select", options: ["2 portas", "4 portas"] },
    ],
    opcionais: [
      "Air bag", "Ar condicionado", "Alarme", "Trava eletrica", "Vidro eletrico",
      "Direcao hidraulica", "Sensor de re", "Cambio automatico", "Som", "Rodas de liga leve",
    ],
  },
  {
    slug: "celulares",
    label: "Celulares e telefones",
    icon: "📱",
    fields: [
      { key: "marca", label: "Marca", type: "text", placeholder: "Samsung" },
      { key: "modelo", label: "Modelo", type: "text", placeholder: "Galaxy S21" },
      { key: "armazenamento", label: "Armazenamento", type: "select", options: ["16 GB", "32 GB", "64 GB", "128 GB", "256 GB", "512 GB", "1 TB"] },
      { key: "memoria_ram", label: "Memoria RAM", type: "select", options: ["2 GB", "3 GB", "4 GB", "6 GB", "8 GB", "12 GB", "16 GB"] },
      { key: "cor", label: "Cor", type: "text", placeholder: "Preto" },
      { key: "estado", label: "Estado", type: "select", options: ESTADO },
    ],
    opcionais: ["Com caixa", "Com nota fiscal", "Carregador", "Biometria", "Dual chip", "5G"],
  },
  {
    slug: "informatica",
    label: "Informatica",
    icon: "💻",
    fields: [
      { key: "marca", label: "Marca", type: "text", placeholder: "Dell" },
      { key: "modelo", label: "Modelo", type: "text", placeholder: "Inspiron 15" },
      { key: "processador", label: "Processador", type: "text", placeholder: "Intel Core i5" },
      { key: "memoria_ram", label: "Memoria RAM", type: "select", options: ["4 GB", "8 GB", "16 GB", "32 GB", "64 GB"] },
      { key: "armazenamento", label: "Armazenamento", type: "text", placeholder: "256 GB SSD" },
      { key: "estado", label: "Estado", type: "select", options: ESTADO },
    ],
    opcionais: ["Com caixa", "Com nota fiscal", "Carregador", "SSD", "Placa de video dedicada", "Touchscreen"],
  },
  {
    slug: "eletronicos",
    label: "Eletronicos e videogames",
    icon: "🎮",
    fields: [
      { key: "marca", label: "Marca", type: "text", placeholder: "Sony" },
      { key: "modelo", label: "Modelo", type: "text", placeholder: "PlayStation 5" },
      { key: "cor", label: "Cor", type: "text" },
      { key: "estado", label: "Estado", type: "select", options: ESTADO },
    ],
    opcionais: ["Com caixa", "Com nota fiscal", "Na garantia", "Acompanha acessorios"],
  },
  {
    slug: "imoveis",
    label: "Imoveis",
    icon: "🏠",
    fields: [
      { key: "tipo", label: "Tipo", type: "select", options: ["Casa", "Apartamento", "Terreno", "Comercial", "Sitio/Chacara"] },
      { key: "quartos", label: "Quartos", type: "number" },
      { key: "banheiros", label: "Banheiros", type: "number" },
      { key: "vagas", label: "Vagas na garagem", type: "number" },
      { key: "area", label: "Area", type: "number", unit: "m2" },
    ],
    opcionais: ["Mobiliado", "Condominio fechado", "Aceita financiamento", "Aceita pet", "Area de lazer"],
  },
  {
    slug: "moveis",
    label: "Moveis e decoracao",
    icon: "🛋️",
    fields: [
      { key: "tipo", label: "Tipo", type: "text", placeholder: "Sofa" },
      { key: "material", label: "Material", type: "text", placeholder: "Madeira" },
      { key: "cor", label: "Cor", type: "text" },
      { key: "estado", label: "Estado", type: "select", options: ESTADO },
    ],
  },
  {
    slug: "moda",
    label: "Moda e beleza",
    icon: "👕",
    fields: [
      { key: "tipo", label: "Tipo", type: "text", placeholder: "Tenis" },
      { key: "marca", label: "Marca", type: "text", placeholder: "Nike" },
      { key: "tamanho", label: "Tamanho", type: "text", placeholder: "42" },
      { key: "cor", label: "Cor", type: "text" },
      { key: "estado", label: "Estado", type: "select", options: ESTADO },
    ],
  },
  {
    slug: "outros",
    label: "Outros",
    icon: "📦",
    fields: [
      { key: "estado", label: "Estado", type: "select", options: ESTADO },
    ],
  },
];

export const DEFAULT_CATEGORY = "outros";

export const CATEGORY_MAP: Record<string, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c]),
);

// DEFAULT_CATEGORY ("outros") sempre existe na lista acima.
const FALLBACK_CATEGORY = CATEGORY_MAP[DEFAULT_CATEGORY] as Category;

export function getCategory(slug?: string | null): Category {
  return (slug ? CATEGORY_MAP[slug] : undefined) ?? FALLBACK_CATEGORY;
}

/** Chave reservada, dentro de attributes, para a lista de opcionais marcados. */
export const OPCIONAIS_KEY = "opcionais";

export type ProductAttributes = Record<string, string | string[]>;

/** Formata "quilometragem" -> "45.000 km" usando a definicao do campo. */
export function formatAttrValue(field: AttrField, value: string): string {
  if (field.type === "number") {
    const n = Number(value);
    if (Number.isFinite(n)) {
      const formatted = n.toLocaleString("pt-BR");
      return field.unit ? `${formatted} ${field.unit}` : formatted;
    }
  }
  return field.unit ? `${value} ${field.unit}` : value;
}

/**
 * Resolve os atributos salvos de um produto em pares rotulo/valor prontos para
 * exibicao, na ordem definida pela categoria. Campos vazios sao omitidos.
 */
export function describeAttributes(
  categorySlug: string | null | undefined,
  attributes: ProductAttributes | null | undefined,
): { rows: { label: string; value: string }[]; opcionais: string[]; category: Category } {
  const category = getCategory(categorySlug);
  const attrs = attributes ?? {};
  const rows: { label: string; value: string }[] = [];

  for (const field of category.fields) {
    const raw = attrs[field.key];
    if (typeof raw === "string" && raw.trim() !== "") {
      rows.push({ label: field.label, value: formatAttrValue(field, raw.trim()) });
    }
  }

  const opcionaisRaw = attrs[OPCIONAIS_KEY];
  const opcionais = Array.isArray(opcionaisRaw) ? opcionaisRaw.filter(Boolean) : [];

  return { rows, opcionais, category };
}
