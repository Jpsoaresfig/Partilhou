"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import ImageUploader from "@/components/ImageUploader";
import AttributeFields from "@/components/AttributeFields";
import PricingFields, {
  pricingFromProduct,
  pricingToBody,
  type PricingValue,
} from "@/components/PricingFields";
import type { CommissionModel, CommissionTier } from "@/lib/money";
import { DEFAULT_CATEGORY, OPCIONAIS_KEY, type ProductAttributes } from "@/lib/categories";

type Product = {
  id: string;
  title: string;
  description: string;
  images: string[];
  amount_total_cents: number;
  min_price_cents?: number | null;
  commission_bps: number;
  commission_min_bps?: number | null;
  commission_model?: CommissionModel | null;
  commission_tiers?: CommissionTier[] | null;
  status: string;
  category?: string | null;
  attributes?: ProductAttributes | null;
};

/** Separa os atributos salvos em campos (string) e opcionais (array). */
function splitAttributes(attributes?: ProductAttributes | null): {
  attrs: Record<string, string>;
  opcionais: string[];
} {
  const attrs: Record<string, string> = {};
  let opcionais: string[] = [];
  for (const [k, v] of Object.entries(attributes ?? {})) {
    if (k === OPCIONAIS_KEY && Array.isArray(v)) opcionais = v;
    else if (typeof v === "string") attrs[k] = v;
  }
  return { attrs, opcionais };
}

export default function EditProductForm({ product }: { product: Product }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const [title, setTitle] = useState(product.title);
  const [description, setDescription] = useState(product.description ?? "");
  const [images, setImages] = useState<string[]>(product.images ?? []);
  const [pricing, setPricing] = useState<PricingValue>(pricingFromProduct(product));
  const [status, setStatus] = useState(product.status);
  const [platformFeeBps, setPlatformFeeBps] = useState(500);

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

  const initial = splitAttributes(product.attributes);
  const [category, setCategory] = useState(product.category || DEFAULT_CATEGORY);
  const [attrs, setAttrs] = useState<Record<string, string>>(initial.attrs);
  const [opcionais, setOpcionais] = useState<string[]>(initial.opcionais);

  function buildAttributes(): ProductAttributes {
    const out: ProductAttributes = {};
    for (const [k, v] of Object.entries(attrs)) {
      if (v.trim() !== "") out[k] = v.trim();
    }
    if (opcionais.length) out[OPCIONAIS_KEY] = opcionais;
    return out;
  }

  async function patch(body: Record<string, unknown>, redirectTo?: string) {
    setBusy(true);
    setError(null);
    setOk(false);
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Falha ao salvar");
        return;
      }
      setOk(true);
      if (redirectTo) {
        router.push(redirectTo);
      }
      router.refresh();
    } catch {
      setError("Erro de rede");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Excluir este anuncio?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error ?? "Falha ao excluir");
        return;
      }
      router.push("/painel");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container" style={{ maxWidth: 680, paddingTop: "2rem" }}>
      <h1>Editar anuncio</h1>
      {error && <div className="alert alert-error">{error}</div>}
      {ok && <div className="alert alert-ok">Salvo!</div>}

      <div className="card">
        <div className="field">
          <label>Titulo</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
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
          <label>Imagens</label>
          <ImageUploader value={images} onChange={setImages} />
        </div>
        <PricingFields value={pricing} onChange={setPricing} platformFeeBps={platformFeeBps} />

        <div className="field" style={{ maxWidth: 200 }}>
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ativo">Ativo</option>
            <option value="pausado">Pausado</option>
          </select>
        </div>

        <div className="row wrap">
          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={() =>
              patch(
                {
                  title,
                  description,
                  images,
                  ...pricingToBody(pricing),
                  status,
                  category,
                  attributes: buildAttributes(),
                },
                `/produto/${product.id}`,
              )
            }
          >
            Salvar alteracoes
          </button>
          <button className="btn btn-danger" disabled={busy} onClick={remove}>
            Excluir anuncio
          </button>
        </div>
      </div>
    </main>
  );
}
