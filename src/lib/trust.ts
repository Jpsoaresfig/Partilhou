/**
 * Confianca de anuncio (trust score) — classificacao automatica e NAO bloqueante.
 *
 * Filosofia: produtos nunca sao barrados do marketplace por falta de validacao;
 * eles sao CLASSIFICADOS por nivel de confianca e recebem mais/menos destaque.
 * Isso aumenta seguranca sem matar a liquidez (oferta de produtos).
 *
 * O score (0..100) soma tres sinais de completude/consistencia:
 *   - Fotos obrigatorias (frente, verso, lateral, tela ligada, IMEI...) — peso alto
 *   - Descricao estruturada (modelo/identidade, condicao, e armazenamento p/ celular)
 *   - IMEI valido (formato + Luhn), quando a categoria for celular
 *
 * O selo "Verificado" (approved) e atingivel automaticamente por completude, mas
 * o admin pode sempre rebaixar/rejeitar (anti-fraude) via app.review_product —
 * e a re-classificacao automatica respeita decisoes humanas (ver classify_product).
 */
import { MIN_PRODUCT_IMAGES } from "@/lib/validation";

export type VerificationStatus = "approved" | "partial" | "unverified";

/** Dados do anuncio relevantes para o score. Tudo opcional (entrada parcial ok). */
export type TrustProduct = {
  images?: string[] | null;
  description?: string | null;
  imei?: string | null;
  category?: string | null;
  attributes?: Record<string, unknown> | null;
};

export type TrustBreakdown = {
  photos: number;
  description: number;
  imei: number;
};

export type TrustResult = {
  score: number; // 0..100
  status: VerificationStatus;
  breakdown: TrustBreakdown;
  /** Recomendacoes em pt-BR do que falta para subir de nivel. */
  reasons: string[];
};

// Categorias em que o IMEI faz sentido (celulares). Para as demais, o peso do
// IMEI e redistribuido entre fotos e descricao para nao penalizar a liquidez.
const PHONE_CATEGORIES = new Set(["celulares"]);

// Limiares de classificacao a partir do score final.
const VERIFIED_MIN = 80;
const PARTIAL_MIN = 45;

/** Valida o IMEI: 14-16 digitos; para 15 digitos exige checksum de Luhn. */
export function isValidImei(imei?: string | null): boolean {
  if (!imei) return false;
  const digits = imei.trim();
  if (!/^\d{14,16}$/.test(digits)) return false;
  // IMEISV (16) e variacoes (14) nao tem digito verificador padronizado: aceita formato.
  if (digits.length !== 15) return true;
  return luhnValid(digits);
}

function luhnValid(num: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = num.charCodeAt(i) - 48; // '0' = 48
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Texto nao-vazio dentro de attributes (string ou primeiro item de array). */
function attrText(attributes: Record<string, unknown> | null | undefined, key: string): string {
  const raw = attributes?.[key];
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0].trim();
  return "";
}

function hasAny(attributes: Record<string, unknown> | null | undefined, keys: string[]): boolean {
  return keys.some((k) => attrText(attributes, k) !== "");
}

/**
 * Calcula o score de confianca e a classificacao de um anuncio.
 *
 * Pesos (celular):     fotos 30 | descricao 30 | IMEI 40
 * Pesos (nao-celular): fotos 50 | descricao 50 | IMEI  0  (redistribuido)
 */
export function calculateTrustScore(product: TrustProduct): TrustResult {
  const isPhone = PHONE_CATEGORIES.has((product.category ?? "").toLowerCase());
  const weights = isPhone
    ? { photos: 30, description: 30, imei: 40 }
    : { photos: 50, description: 50, imei: 0 };

  const reasons: string[] = [];

  // --- Fotos: completas (>=6) valem cheio; algumas (>=3) valem metade. ---------
  const photoCount = Array.isArray(product.images) ? product.images.length : 0;
  let photoRatio = 0;
  if (photoCount >= MIN_PRODUCT_IMAGES) photoRatio = 1;
  else if (photoCount >= Math.ceil(MIN_PRODUCT_IMAGES / 2)) photoRatio = 0.5;
  const photos = Math.round(weights.photos * photoRatio);
  if (photoRatio < 1) {
    reasons.push(`Envie ao menos ${MIN_PRODUCT_IMAGES} fotos (frente, verso, lateral, tela ligada, IMEI).`);
  }

  // --- Descricao estruturada: identidade + condicao (+ armazenamento p/ celular). ---
  const attrs = product.attributes ?? null;
  const hasIdentity = hasAny(attrs, ["modelo", "marca", "tipo"]);
  const hasCondition = hasAny(attrs, ["estado", "condicao"]);
  const hasFreeText = (product.description ?? "").trim().length >= 60;
  // Terceiro sinal: armazenamento para celular; senao, descricao livre util.
  const thirdSignal = isPhone ? hasAny(attrs, ["armazenamento"]) : hasFreeText;

  const descChecks = [hasIdentity, hasCondition, thirdSignal];
  const descRatio = descChecks.filter(Boolean).length / descChecks.length;
  const description = Math.round(weights.description * descRatio);
  if (!hasIdentity) reasons.push("Informe modelo/marca do produto.");
  if (!hasCondition) reasons.push("Informe a condicao (novo, seminovo, usado).");
  if (isPhone && !thirdSignal) reasons.push("Informe o armazenamento do aparelho.");
  if (!isPhone && !thirdSignal) reasons.push("Detalhe melhor a descricao (ao menos 60 caracteres).");

  // --- IMEI: so pontua em celulares, quando valido (formato + Luhn p/ 15 digitos). ---
  let imei = 0;
  if (isPhone) {
    if (isValidImei(product.imei)) imei = weights.imei;
    else reasons.push("Informe um IMEI valido para verificacao completa.");
  }

  const score = Math.max(0, Math.min(100, photos + description + imei));
  const status: VerificationStatus =
    score >= VERIFIED_MIN ? "approved" : score >= PARTIAL_MIN ? "partial" : "unverified";

  return { score, status, breakdown: { photos, description, imei }, reasons };
}

/** Rotulo + emoji do selo por status (UI). */
export function trustBadge(status: string | undefined, score?: number) {
  const s = typeof score === "number" ? ` · ${score}/100` : "";
  switch (status) {
    case "approved":
      return { label: `🟢 Verificado${s}`, className: "badge-success", title: "Anuncio verificado pela Partilhou" };
    case "partial":
      return { label: `🟡 Parcial${s}`, className: "badge-warn", title: "Validacao parcial — faltam dados para verificacao completa" };
    case "rejected":
      return { label: "🔴 Reprovado", className: "badge-danger", title: "Anuncio reprovado pela moderacao" };
    default: // unverified / pending_review
      return { label: `⚪ Nao verificado${s}`, className: "badge-muted", title: "Anuncio ainda nao verificado" };
  }
}
