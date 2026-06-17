"use client";

import { useState } from "react";
import Link from "next/link";

type Shipping = {
  recipient: string;
  zip: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
};

const EMPTY_SHIPPING: Shipping = {
  recipient: "",
  zip: "",
  street: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "",
};

export default function ProductActions({
  productId,
  authed,
  isSeller,
  affiliateCode,
  buyerName,
}: {
  productId: string;
  authed: boolean;
  isSeller: boolean;
  affiliateCode?: string;
  buyerName?: string;
}) {
  const [busy, setBusy] = useState<"buy" | "promote" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showShipping, setShowShipping] = useState(false);
  const [shipping, setShipping] = useState<Shipping>({
    ...EMPTY_SHIPPING,
    recipient: buyerName ?? "",
  });

  if (!authed) {
    return (
      <Link href="/login" className="btn btn-primary btn-block">
        Entre para comprar ou afiliar
      </Link>
    );
  }

  if (isSeller) {
    return (
      <div className="alert alert-ok" style={{ marginBottom: 0 }}>
        Este e o seu anuncio. Acompanhe vendas no{" "}
        <Link href="/painel" style={{ color: "var(--primary)" }}>painel</Link>.
      </div>
    );
  }

  function setField(key: keyof Shipping, value: string) {
    setShipping((s) => ({ ...s, [key]: value }));
  }

  const shippingValid =
    shipping.recipient.trim().length >= 2 &&
    /^\d{5}-?\d{3}$/.test(shipping.zip.trim()) &&
    shipping.street.trim().length >= 2 &&
    shipping.number.trim().length >= 1 &&
    shipping.city.trim().length >= 2 &&
    shipping.state.trim().length === 2;

  async function buy() {
    setBusy("buy");
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          affiliate_code: affiliateCode,
          shipping,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Falha no checkout");
        return;
      }
      window.location.href = json.data.checkout_url;
    } catch {
      setError("Erro de rede");
    } finally {
      setBusy(null);
    }
  }

  async function promote() {
    setBusy("promote");
    setError(null);
    try {
      const res = await fetch("/api/affiliate/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Falha ao gerar link");
        return;
      }
      setShareUrl(json.data.share_url);
    } catch {
      setError("Erro de rede");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="stack">
      {error && <div className="alert alert-error" style={{ marginBottom: 0 }}>{error}</div>}

      {!showShipping ? (
        <button
          className="btn btn-primary btn-block"
          onClick={() => {
            setError(null);
            setShowShipping(true);
          }}
          disabled={busy !== null}
        >
          Comprar com seguranca
        </button>
      ) : (
        <div className="split-box stack">
          <div className="small muted" style={{ marginBottom: 2 }}>
            Endereco de entrega
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Destinatario</label>
            <input
              className="input"
              value={shipping.recipient}
              onChange={(e) => setField("recipient", e.target.value)}
              placeholder="Nome de quem recebe"
            />
          </div>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ margin: 0, flex: "0 0 38%" }}>
              <label>CEP</label>
              <input
                className="input"
                value={shipping.zip}
                onChange={(e) => setField("zip", e.target.value)}
                placeholder="00000-000"
                inputMode="numeric"
              />
            </div>
            <div className="field" style={{ margin: 0, flex: 1 }}>
              <label>Rua</label>
              <input
                className="input"
                value={shipping.street}
                onChange={(e) => setField("street", e.target.value)}
                placeholder="Av. Brasil"
              />
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ margin: 0, flex: "0 0 28%" }}>
              <label>Numero</label>
              <input
                className="input"
                value={shipping.number}
                onChange={(e) => setField("number", e.target.value)}
                placeholder="123"
              />
            </div>
            <div className="field" style={{ margin: 0, flex: 1 }}>
              <label>Complemento</label>
              <input
                className="input"
                value={shipping.complement}
                onChange={(e) => setField("complement", e.target.value)}
                placeholder="Apto 4 (opcional)"
              />
            </div>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Bairro</label>
            <input
              className="input"
              value={shipping.district}
              onChange={(e) => setField("district", e.target.value)}
              placeholder="Centro (opcional)"
            />
          </div>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ margin: 0, flex: 1 }}>
              <label>Cidade</label>
              <input
                className="input"
                value={shipping.city}
                onChange={(e) => setField("city", e.target.value)}
                placeholder="Sao Paulo"
              />
            </div>
            <div className="field" style={{ margin: 0, flex: "0 0 26%" }}>
              <label>UF</label>
              <input
                className="input"
                value={shipping.state}
                onChange={(e) => setField("state", e.target.value.toUpperCase())}
                placeholder="SP"
                maxLength={2}
              />
            </div>
          </div>
          <button
            className="btn btn-primary btn-block"
            onClick={buy}
            disabled={busy !== null || !shippingValid}
          >
            {busy === "buy" ? "Redirecionando..." : "Pagar com seguranca"}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowShipping(false)}
            disabled={busy !== null}
          >
            Cancelar
          </button>
        </div>
      )}

      <button className="btn btn-ghost btn-block" onClick={promote} disabled={busy !== null}>
        {busy === "promote" ? "Gerando..." : "Promover e ganhar comissao"}
      </button>

      {shareUrl && (
        <div className="split-box">
          <div className="small muted" style={{ marginBottom: 6 }}>Seu link de afiliado</div>
          <div className="row" style={{ gap: 6 }}>
            <input className="input" readOnly value={shareUrl} />
            <button
              className="btn btn-sm"
              onClick={() => {
                navigator.clipboard.writeText(shareUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "Copiado!" : "Copiar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
