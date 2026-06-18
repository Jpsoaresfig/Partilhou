"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export type ChatMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

const POLL_MS = 4000;

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function ChatThread({
  conversationId,
  currentUserId,
  initialMessages,
}: {
  conversationId: string;
  currentUserId: string;
  initialMessages: ChatMessage[];
}) {
  const supabase = useRef(createSupabaseBrowserClient());
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Marca como lidas as mensagens recebidas (do outro participante).
  const markRead = useCallback(async () => {
    await supabase.current
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .neq("sender_id", currentUserId)
      .is("read_at", null);
  }, [conversationId, currentUserId]);

  // Busca mensagens mais novas que a ultima conhecida e anexa as inexistentes.
  const poll = useCallback(async () => {
    const last = messages[messages.length - 1]?.created_at;
    let q = supabase.current
      .from("messages")
      .select("id, sender_id, body, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (last) q = q.gt("created_at", last);
    const { data } = await q;
    if (data && data.length) {
      setMessages((prev) => {
        const have = new Set(prev.map((m) => m.id));
        const fresh = (data as ChatMessage[]).filter((m) => !have.has(m.id));
        return fresh.length ? [...prev, ...fresh] : prev;
      });
    }
  }, [conversationId, messages]);

  useEffect(() => {
    markRead();
  }, [markRead, messages]);

  useEffect(() => {
    const t = setInterval(poll, POLL_MS);
    return () => clearInterval(t);
  }, [poll]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function send() {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.current
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: currentUserId, body })
      .select("id, sender_id, body, created_at")
      .single();
    if (err) {
      setError("Nao foi possivel enviar a mensagem.");
    } else if (data) {
      setMessages((prev) => [...prev, data as ChatMessage]);
      setDraft("");
    }
    setBusy(false);
  }

  return (
    <div className="card stack" style={{ gap: "0.75rem" }}>
      <div
        className="stack"
        style={{
          gap: "0.5rem",
          maxHeight: "55vh",
          overflowY: "auto",
          paddingRight: 4,
        }}
      >
        {messages.length === 0 ? (
          <p className="muted small center">
            Inicie a conversa enviando uma mensagem.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === currentUserId;
            return (
              <div
                key={m.id}
                style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}
              >
                <div
                  className="split-box"
                  style={{
                    maxWidth: "78%",
                    background: mine ? "var(--primary-weak)" : undefined,
                    margin: 0,
                  }}
                >
                  <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.body}</div>
                  <div className="muted small" style={{ textAlign: "right", marginTop: 2 }}>
                    {timeLabel(m.created_at)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 0 }}>{error}</div>}

      <div className="row" style={{ gap: 6, alignItems: "flex-end" }}>
        <textarea
          className="textarea"
          style={{ minHeight: 44, flex: 1 }}
          value={draft}
          maxLength={4000}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Escreva uma mensagem..."
        />
        <button className="btn btn-primary" onClick={send} disabled={busy || !draft.trim()}>
          {busy ? "..." : "Enviar"}
        </button>
      </div>
    </div>
  );
}
