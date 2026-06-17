"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function ProfileForm({
  userId,
  initial,
}: {
  userId: string;
  initial: { full_name: string; document_number: string; phone: string; pix_key: string };
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initial.full_name);
  const [doc, setDoc] = useState(initial.document_number);
  const [phone, setPhone] = useState(initial.phone);
  const [pix, setPix] = useState(initial.pix_key);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(false);
    const supabase = createSupabaseBrowserClient();
    try {
      const r1 = await supabase.from("profiles").update({ full_name: fullName }).eq("id", userId);
      const r2 = await supabase
        .from("profiles_private")
        .upsert({ profile_id: userId, document_number: doc || null, phone: phone || null });
      const r3 = await supabase
        .from("wallet_payout_methods")
        .upsert({ user_id: userId, pix_key: pix || null });

      const err = r1.error || r2.error || r3.error;
      if (err) {
        setError(err.message);
        return;
      }
      setOk(true);
      router.refresh();
    } catch {
      setError("Falha ao salvar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="card">
      {error && <div className="alert alert-error">{error}</div>}
      {ok && <div className="alert alert-ok">Dados salvos!</div>}

      <div className="field">
        <label>Nome completo</label>
        <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div className="row wrap">
        <div className="field" style={{ flex: 1, minWidth: 180 }}>
          <label>CPF/CNPJ</label>
          <input className="input" value={doc} onChange={(e) => setDoc(e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1, minWidth: 180 }}>
          <label>Telefone</label>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>Chave PIX (para receber saques)</label>
        <input className="input" value={pix} onChange={(e) => setPix(e.target.value)} placeholder="email, CPF, telefone ou aleatoria" />
      </div>
      <button className="btn btn-primary" disabled={busy}>
        {busy ? "Salvando..." : "Salvar"}
      </button>
    </form>
  );
}
