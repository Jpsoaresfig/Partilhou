"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { bpsToPercent } from "@/lib/money";
import ImageUploader from "@/components/ImageUploader";

type Product = {
  id: string;
  title: string;
  description: string;
  images: string[];
  amount_total_cents: number;
  commission_bps: number;
  status: string;
};

export default function EditProductForm({ product }: { product: Product }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const [title, setTitle] = useState(product.title);
  const [description, setDescription] = useState(product.description ?? "");
  const [images, setImages] = useState<string[]>(product.images ?? []);
  const [amount, setAmount] = useState((product.amount_total_cents / 100).toFixed(2));
  const [commission, setCommission] = useState(String(bpsToPercent(product.commission_bps)));
  const [status, setStatus] = useState(product.status);

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
        <div className="field">
          <label>Imagens</label>
          <ImageUploader value={images} onChange={setImages} />
        </div>
        <div className="row wrap">
          <div className="field" style={{ flex: 1, minWidth: 160 }}>
            <label>Preco (R$)</label>
            <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 160 }}>
            <label>Comissao (%)</label>
            <input className="input" inputMode="decimal" value={commission} onChange={(e) => setCommission(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 160 }}>
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="ativo">Ativo</option>
              <option value="pausado">Pausado</option>
            </select>
          </div>
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
                  amount_total: amount,
                  commission_percent: commission,
                  status,
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
