"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MailCheck } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/v1/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-white/10 bg-white/[0.03] p-8">
        {sent ? (
          <div className="text-center">
            <div className="mb-3 flex justify-center">
              <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                <MailCheck className="size-5" />
              </span>
            </div>
            <h1 className="text-lg font-semibold text-white">Email envoyé</h1>
            <p className="mt-2 text-sm text-white/60">
              Si un compte existe pour <span className="text-white">{email}</span>,
              vous recevrez un lien de réinitialisation dans quelques minutes.
            </p>
            <Link
              href="/login"
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-amber-400 hover:underline"
            >
              <ArrowLeft className="size-4" /> Retour à la connexion
            </Link>
          </div>
        ) : (
          <>
            <div className="text-center">
              <h1 className="text-lg font-semibold text-white">
                Mot de passe oublié
              </h1>
              <p className="mt-1 text-sm text-white/50">
                Entrez votre email, on vous envoie un lien pour en choisir un
                nouveau.
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label htmlFor="email" className="app-label">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="app-input w-full"
                  placeholder="vous@exemple.be"
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? "Envoi…" : "Envoyer le lien"}
              </button>
            </form>

            <p className="text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white"
              >
                <ArrowLeft className="size-4" /> Retour à la connexion
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
