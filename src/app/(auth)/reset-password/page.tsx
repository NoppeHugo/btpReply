"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";

// Sert deux cas : reset « mot de passe oublié » et lien d'invitation d'un
// compte créé sans mot de passe (?invite=1 pour adapter le libellé).

function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const invite = params.get("invite") === "1";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Lien invalide ou expiré.");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 1800);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <p className="text-center text-sm text-white/60">
        Lien invalide.{" "}
        <Link href="/forgot-password" className="text-amber-400 hover:underline">
          Demander un nouveau lien
        </Link>
      </p>
    );
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="mb-3 flex justify-center">
          <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <Check className="size-5" />
          </span>
        </div>
        <h1 className="text-lg font-semibold text-white">
          Mot de passe enregistré
        </h1>
        <p className="mt-2 text-sm text-white/60">
          Redirection vers la connexion…
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="text-center">
        <h1 className="text-lg font-semibold text-white">
          {invite ? "Bienvenue sur Rappl" : "Nouveau mot de passe"}
        </h1>
        <p className="mt-1 text-sm text-white/50">
          {invite
            ? "Choisissez le mot de passe de votre espace."
            : "Choisissez votre nouveau mot de passe."}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="password" className="app-label">
            Mot de passe (8 caractères min.)
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="app-input w-full"
            placeholder="••••••••"
          />
        </div>
        <div>
          <label htmlFor="confirm" className="app-label">
            Confirmez le mot de passe
          </label>
          <input
            id="confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="app-input w-full"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-400">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Enregistrement…" : "Enregistrer"}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="app-shell flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-white/10 bg-white/[0.03] p-8">
        <Suspense>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
