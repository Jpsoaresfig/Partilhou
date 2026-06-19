/**
 * Definicoes compartilhadas dos Grupos (comunidades de vendas e promocoes).
 *
 * O banco guarda `theme` (enum) e, opcionalmente, `cover` (gradiente CSS). Os
 * rotulos, icones e a cor da capa de cada tema vivem aqui e sao reutilizados
 * pela vitrine de grupos, pelo formulario de criacao e pelo seed.
 */

export type GroupTheme =
  | "geral"
  | "promocoes"
  | "eletronicos"
  | "moda"
  | "casa"
  | "automotivo"
  | "regionais";

export type GroupVisibility = "publico" | "privado";

export type ThemeDef = {
  slug: GroupTheme;
  label: string;
  icon: string;
  /** gradiente da capa (CSS) usado quando o grupo nao define um `cover` proprio */
  cover: string;
};

export const GROUP_THEMES: ThemeDef[] = [
  { slug: "geral",       label: "Geral",       icon: "🌐", cover: "linear-gradient(135deg, #16c79a, #4a90d9)" },
  { slug: "promocoes",   label: "Promocoes",   icon: "🔥", cover: "linear-gradient(135deg, #ff7a59, #ffb454)" },
  { slug: "eletronicos", label: "Eletronicos", icon: "📱", cover: "linear-gradient(135deg, #16c79a, #11a982)" },
  { slug: "moda",        label: "Moda",        icon: "👟", cover: "linear-gradient(135deg, #a06bff, #6b8bff)" },
  { slug: "casa",        label: "Casa",        icon: "🛋️", cover: "linear-gradient(135deg, #ffb454, #ff8a8a)" },
  { slug: "automotivo",  label: "Automotivo",  icon: "🚗", cover: "linear-gradient(135deg, #4a90d9, #16c79a)" },
  { slug: "regionais",   label: "Regionais",   icon: "📍", cover: "linear-gradient(135deg, #ef5350, #ffb454)" },
];

const THEME_MAP: Record<string, ThemeDef> = Object.fromEntries(
  GROUP_THEMES.map((t) => [t.slug, t]),
);

// "geral" sempre existe em GROUP_THEMES acima.
const FALLBACK_THEME = THEME_MAP.geral as ThemeDef;

export function getTheme(slug?: string | null): ThemeDef {
  return (slug ? THEME_MAP[slug] : undefined) ?? FALLBACK_THEME;
}

/** Capa do grupo: usa a do grupo se houver, senao a do tema. */
export function groupCover(cover?: string | null, theme?: string | null): string {
  return cover && cover.trim() ? cover : getTheme(theme).cover;
}

/** Icone do grupo: usa o do grupo se houver, senao o do tema. */
export function groupIcon(icon?: string | null, theme?: string | null): string {
  return icon && icon.trim() ? icon : getTheme(theme).icon;
}

/** "12,8 mil membros" / "340 membros". */
export function membersLabel(n: number): string {
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1).replace(".", ",").replace(",0", "")} mil membros`;
  }
  return `${n} ${n === 1 ? "membro" : "membros"}`;
}

/**
 * Gera um slug de URL a partir do nome do grupo: minusculas, sem acentos, apenas
 * [a-z0-9-]. Casa com o CHECK da coluna `groups.slug` (3 a 60 chars). Colisoes de
 * nome sao tratadas pela constraint UNIQUE (a rota devolve 409).
 */
export function slugify(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // tira acentos (marcas diacriticas)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  // Garante o minimo de 3 caracteres exigido pelo banco.
  return base.length >= 3 ? base : `grupo-${base}`.slice(0, 60);
}
