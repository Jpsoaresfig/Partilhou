"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import ImageUploader from "@/components/ImageUploader";
import AttributeFields from "@/components/AttributeFields";
import PricingFields, { EMPTY_PRICING, pricingToBody, type PricingValue } from "@/components/PricingFields";
import { DEFAULT_CATEGORY, OPCIONAIS_KEY, type ProductAttributes } from "@/lib/categories";

export default function SellForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [platformFeeBps, setPlatformFeeBps] = useState(500);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imei, setImei] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [pricing, setPricing] = useState<PricingValue>(EMPTY_PRICING);
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [attrs, setAttrs] = useState<Record<string, string>>({});
  const [opcionais, setOpcionais] = useState<string[]>([]);

  function buildAttributes(): ProductAttributes {
    const out: ProductAttributes = {};
    for (const [k, v] of Object.entries(attrs)) {
      if (v.trim() !== "") out[k] = v.trim();
    }
    if (opcionais.length) out[OPCIONAIS_KEY] = opcionais;
    return out;
  }

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "platform_fee_bps")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setPlatformFeeBps(Number(data.value));
      });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          imei: imei.trim() || undefined,
          images,
          ...pricingToBody(pricing),
          category,
          attributes: buildAttributes(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Falha ao publicar");
        return;
      }
      router.push(`/produto/${json.data.product.id}`);
      router.refresh();
    } catch {
      setError("Erro de rede");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container" style={{ maxWidth: 760, paddingTop: "2rem" }}>
      <h1>Anunciar produto</h1>
      <p className="muted mb-3">
        Defina o preco e quanto da venda vai para quem te indicar. Seu anuncio entra
        na hora e recebe um selo de confianca automatico conforme a completude dos dados.
      </p>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="grid" style={{ gridTemplateColumns: "1fr", gap: "1.25rem" }}>
        <form onSubmit={onSubmit} className="card">
          <div className="field">
            <label>Titulo</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} />
          </div>
          <div className="field">
            <label>Descricao</label>
            <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <AttributeFields
            category={category}
            attrs={attrs}
            opcionais={opcionais}
            onCategory={(slug) => {
              setCategory(slug);
              setAttrs({});
              setOpcionais([]);
            }}
            onAttrs={setAttrs}
            onOpcionais={setOpcionais}
          />
          <div className="field">
            <label>IMEI (celulares)</label>
            <input
              className="input"
              value={imei}
              onChange={(e) => setImei(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              maxLength={16}
              placeholder="15 digitos (disque *#06#). Opcional, mas acelera a verificacao."
            />
            <small className="muted">Conferimos o IMEI contra bloqueio/roubo na validacao.</small>
          </div>
          <div className="field">
            <label>Imagens (recomendado 6+: frente, verso, tela ligada, laterais, IMEI)</label>
            <ImageUploader value={images} onChange={setImages} />
            <small className="muted">
              Mais fotos e dados completos elevam seu selo de confianca (🟢 Verificado).
            </small>
          </div>
          <PricingFields value={pricing} onChange={setPricing} platformFeeBps={platformFeeBps} />
          <button className="btn btn-primary btn-block" disabled={loading}>
            {loading ? "Publicando..." : "Publicar anuncio"}
          </button>
        </form>
      </div>
    </main>
  );
}
