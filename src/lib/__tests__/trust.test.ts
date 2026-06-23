import { describe, it, expect } from "vitest";
import { calculateTrustScore, isValidImei } from "@/lib/trust";

// IMEI valido (passa Luhn, 15 digitos) usado nos casos de celular.
const VALID_IMEI = "490154203237518";

describe("isValidImei", () => {
  it("aceita IMEI de 15 digitos com Luhn correto", () => {
    expect(isValidImei(VALID_IMEI)).toBe(true);
  });
  it("rejeita 15 digitos com checksum errado", () => {
    expect(isValidImei("490154203237519")).toBe(false);
  });
  it("aceita 14/16 digitos (variacoes) so pelo formato", () => {
    expect(isValidImei("12345678901234")).toBe(true);
    expect(isValidImei("1234567890123456")).toBe(true);
  });
  it("rejeita formato invalido / vazio", () => {
    expect(isValidImei("abc")).toBe(false);
    expect(isValidImei("")).toBe(false);
    expect(isValidImei(null)).toBe(false);
  });
});

describe("calculateTrustScore", () => {
  const fullPhotos = Array.from({ length: 6 }, (_, i) => `https://x/${i}.jpg`);

  it("celular completo (fotos+descricao+IMEI) = 100 e verificado", () => {
    const r = calculateTrustScore({
      images: fullPhotos,
      description: "Aparelho em otimo estado, bateria 95%, sem riscos na tela frontal.",
      imei: VALID_IMEI,
      category: "celulares",
      attributes: { modelo: "Galaxy S21", estado: "Seminovo", armazenamento: "128 GB" },
    });
    expect(r.score).toBe(100);
    expect(r.status).toBe("approved");
  });

  it("celular sem IMEI cai para parcial (fotos 30 + descricao 30)", () => {
    const r = calculateTrustScore({
      images: fullPhotos,
      description: "",
      imei: null,
      category: "celulares",
      attributes: { modelo: "iPhone 11", estado: "Usado", armazenamento: "64 GB" },
    });
    expect(r.score).toBe(60);
    expect(r.status).toBe("partial");
  });

  it("so fotos, sem dados = nao verificado", () => {
    const r = calculateTrustScore({
      images: fullPhotos,
      category: "celulares",
      attributes: {},
    });
    expect(r.status).toBe("unverified");
  });

  it("nao penaliza categoria sem IMEI: peso redistribuido em fotos/descricao", () => {
    const r = calculateTrustScore({
      images: fullPhotos,
      description: "Notebook Dell Inspiron, i5, 8GB RAM, SSD 256GB, bateria boa.",
      category: "informatica",
      attributes: { modelo: "Inspiron 15", estado: "Usado" },
    });
    // fotos 50 + descricao 50 (identidade + condicao + texto >=60) = 100
    expect(r.score).toBe(100);
    expect(r.status).toBe("approved");
  });

  it("poucas fotos valem metade do peso", () => {
    const r = calculateTrustScore({
      images: ["a", "b", "c"],
      category: "outros",
      attributes: {},
    });
    expect(r.breakdown.photos).toBe(25); // metade de 50 (categoria sem IMEI)
  });

  it("score sempre entre 0 e 100 e sem reasons quando completo", () => {
    const r = calculateTrustScore({
      images: fullPhotos,
      description: "Texto suficientemente longo para passar do limite de sessenta caracteres aqui.",
      imei: VALID_IMEI,
      category: "celulares",
      attributes: { marca: "Samsung", condicao: "Novo", armazenamento: "256 GB" },
    });
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.reasons).toHaveLength(0);
  });
});
