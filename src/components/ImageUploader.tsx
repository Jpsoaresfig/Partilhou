"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const BUCKET = "product-images";

export default function ImageUploader({
  value,
  onChange,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Sessao expirada. Entre novamente.");
        return;
      }

      const uploaded: string[] = [];
      for (const file of Array.from(files).slice(0, 12 - value.length)) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (upErr) {
          setError(upErr.message);
          continue;
        }
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        uploaded.push(data.publicUrl);
      }
      onChange([...value, ...uploaded]);
    } catch {
      setError("Falha no upload");
    } finally {
      setUploading(false);
    }
  }

  function remove(url: string) {
    onChange(value.filter((u) => u !== url));
  }

  return (
    <div className="stack" style={{ gap: "0.5rem" }}>
      {error && <div className="alert alert-error" style={{ marginBottom: 0 }}>{error}</div>}
      <div className="row wrap">
        {value.map((url) => (
          <div
            key={url}
            className="product-thumb"
            style={{ width: 84, height: 64, borderRadius: 8, position: "relative", backgroundImage: `url(${url})` }}
          >
            <button
              type="button"
              onClick={() => remove(url)}
              className="btn btn-sm btn-danger"
              style={{ position: "absolute", top: -8, right: -8, padding: "0 7px", lineHeight: "20px", borderRadius: 999 }}
              aria-label="Remover"
            >
              ×
            </button>
          </div>
        ))}
        {value.length < 12 && (
          <label className="btn btn-ghost" style={{ width: 84, height: 64, cursor: "pointer" }}>
            {uploading ? "..." : "+ Foto"}
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              disabled={uploading}
              onChange={(e) => handleFiles(e.target.files)}
            />
          </label>
        )}
      </div>
      <span className="muted small">Ate 12 imagens. A primeira e a capa.</span>
    </div>
  );
}
