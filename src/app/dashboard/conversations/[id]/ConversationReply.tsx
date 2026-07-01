"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ConversationReply({
  conversationId,
  autopilot,
}: {
  conversationId: string;
  autopilot: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/conversations/${conversationId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Échec de l'envoi");
      }
      setBody("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSending(false);
    }
  }

  async function setAutopilot(next: boolean) {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autopilot: next }),
      });
      if (!res.ok) throw new Error("Échec du changement de mode");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-4 app-card">
      {/* Bandeau de mode */}
      <div className="mb-3 flex items-center justify-between">
        {autopilot ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-white/50">
            <span className="size-2 rounded-full bg-emerald-500" />
            Réponses automatiques activées
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400">
            <span className="size-2 rounded-full bg-amber-500" />
            Vous avez repris la main
          </span>
        )}
        {autopilot ? null : (
          <button
            onClick={() => setAutopilot(true)}
            disabled={sending}
            className="text-xs text-amber-400 hover:underline disabled:opacity-50"
          >
            Redonner la main au secrétariat
          </button>
        )}
      </div>

      <div className="flex items-end gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
          }}
          rows={2}
          placeholder="Répondre au client par SMS…"
          className="app-input flex-1 resize-none"
        />
        <button
          onClick={send}
          disabled={sending || !body.trim()}
          className="btn-primary"
        >
          {sending ? "…" : "Envoyer"}
        </button>
      </div>
      {autopilot && (
        <p className="mt-2 text-[11px] text-white/40">
          Envoyer un message met les réponses automatiques en pause pour cette conversation.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
