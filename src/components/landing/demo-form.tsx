"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";

type Status = "idle" | "sending" | "sent" | "error";

/**
 * W1 (audit) : formulaire de demande de démo — remplace le mailto: comme
 * canal de conversion principal (cible artisans sur mobile).
 */
export function DemoForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);

    setStatus("sending");
    setError(null);

    try {
      const res = await fetch("/api/v1/demo-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          phone: data.get("phone"),
          company: data.get("company") || undefined,
          website: data.get("website") || undefined,
        }),
      });

      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "Une erreur est survenue");
      }

      setStatus("sent");
      form.reset();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    }
  }

  if (status === "sent") {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-6 text-center">
        <CheckCircle2 className="mx-auto size-8 text-emerald-400" />
        <p className="mt-3 font-semibold text-white">C&apos;est noté !</p>
        <p className="mt-1 text-sm text-white/60">
          On vous rappelle très vite pour la démo. (Oui, on décroche. Et si on
          rate votre appel… vous verrez Rappl en action.)
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto grid max-w-md gap-3 text-left"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          name="name"
          required
          minLength={2}
          maxLength={100}
          placeholder="Votre nom"
          autoComplete="name"
          className="h-11 rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm text-white placeholder:text-white/40 focus:border-amber-400 focus:outline-none"
        />
        <input
          name="phone"
          required
          type="tel"
          pattern="[+0-9 ()./-]{8,20}"
          placeholder="Votre téléphone"
          autoComplete="tel"
          className="h-11 rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm text-white placeholder:text-white/40 focus:border-amber-400 focus:outline-none"
        />
      </div>
      <input
        name="company"
        maxLength={100}
        placeholder="Votre entreprise (optionnel)"
        autoComplete="organization"
        className="h-11 rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm text-white placeholder:text-white/40 focus:border-amber-400 focus:outline-none"
      />
      {/* Honeypot anti-spam : invisible pour les humains */}
      <input
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={status === "sending"}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-amber-500 px-7 text-base font-medium text-neutral-950 transition-colors hover:bg-amber-400 disabled:opacity-60"
      >
        {status === "sending" ? "Envoi…" : "Être rappelé pour une démo"}
        <ArrowRight className="size-4" />
      </button>
      <p className="text-center text-xs text-white/40">
        Vos coordonnées servent uniquement à vous recontacter pour la démo.
      </p>
    </form>
  );
}
