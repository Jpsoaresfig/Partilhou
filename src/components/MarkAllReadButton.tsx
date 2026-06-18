"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MarkAllReadButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function markAll() {
    setBusy(true);
    try {
      await fetch("/api/notifications/read", { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="btn btn-ghost btn-sm" onClick={markAll} disabled={busy}>
      {busy ? "..." : "Marcar todas como lidas"}
    </button>
  );
}
