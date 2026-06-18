"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { UFS } from "@/lib/regions";
import ImageUploader from "@/components/ImageUploader";

export default function ProfileForm({
  userId,
  email,
  initial,
}: {
  userId: string;
  email: string;
  initial: {
    full_name: string;
    avatar_url: string;
    document_number: string;
    phone: string;
    city: string;
    region_uf: string;
    birth_year: string;
    pix_key: string;
  };
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initial.full_name);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatar_url);
  const [doc, setDoc] = useState(initial.document_number);
  const [phone, setPhone] = useState(initial.phone);
  const [city, setCity] = useState(initial.city);
  const [uf, setUf] = useState(initial.region_uf);
  const [birthYear, setBirthYear] = useState(initial.birth_year);
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
      const year = birthYear.trim() ? Number(birthYear) : null;
      if (year !== null && (!Number.isInteger(year) || year < 1900 || year > 2100)) {
        setError("Ano de nascimento invalido");
        return;
      }

      const r1 = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          avatar_url: avatarUrl || null,
          city: city.trim() || null,
          region_uf: uf || null,
        })
        .eq("id", userId);
      const r2 = await supabase
        .from("profiles_private")
        .upsert({
          profile_id: userId,
          document_number: doc || null,
          phone: phone || null,
          birth_year: year,
        });
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
        <label>Foto da loja</label>
        <ImageUploader
          value={avatarUrl ? [avatarUrl] : []}
          onChange={(urls) => setAvatarUrl(urls[0] ?? "")}
          bucket="avatars"
          max={1}
          hint="Uma imagem quadrada funciona melhor."
        />
      </div>

      <div className="field">
        <label>Nome completo</label>
        <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>

      <div className="field">
        <label>E-mail</label>
        <input className="input" value={email} readOnly disabled />
        <span className="muted small">O e-mail e usado para login e nao pode ser alterado aqui.</span>
      </div>

      <div className="row wrap">
        <div className="field" style={{ flex: 1, minWidth: 180 }}>
          <label>CPF/CNPJ</label>
          <input className="input" value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="000.000.000-00" />
        </div>
        <div className="field" style={{ flex: 1, minWidth: 180 }}>
          <label>Celular</label>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
        </div>
      </div>

      <div className="row wrap">
        <div className="field" style={{ flex: 2, minWidth: 180 }}>
          <label>Cidade (de onde voce e)</label>
          <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Sao Paulo" />
        </div>
        <div className="field" style={{ flex: 1, minWidth: 120 }}>
          <label>UF</label>
          <select value={uf} onChange={(e) => setUf(e.target.value)}>
            <option value="">—</option>
            {UFS.map((u) => (
              <option key={u.uf} value={u.uf}>{u.uf}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: 1, minWidth: 120 }}>
          <label>Ano de nascimento</label>
          <input
            className="input"
            inputMode="numeric"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="1997"
          />
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
