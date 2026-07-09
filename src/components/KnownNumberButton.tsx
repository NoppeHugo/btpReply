"use client";

import { useState } from "react";

// Whitelist « passive » : l'artisan marque un numéro connu depuis la liste des
// appels. Le numéro n'enverra plus de SMS auto (POST vers l'endpoint whitelist
// existant, source=passive). N'affecte que les FUTURS appels de ce numéro.

type State = "idle" | "loading" | "done" | "error";

export function KnownNumberButton({ number }: { number: string }) {
  const [state, setState] = useState<State>("idle");

  async function add() {
    setState("loading");
    try {
      const res = await fetch("/api/v1/config/whitelist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number, source: "passive", label: "connu" }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <span className="text-xs text-emerald-400" title="Numéro exclu des SMS automatiques">
        ✓ Connu
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={add}
      disabled={state === "loading"}
      title="Je connais ce numéro : ne plus lui envoyer de SMS automatique"
      className="text-xs text-white/50 hover:text-white/80 disabled:opacity-50"
    >
      {state === "loading" ? "…" : state === "error" ? "Réessayer" : "Je connais"}
    </button>
  );
}
