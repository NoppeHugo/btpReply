"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewClientPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    timezone: "Europe/Brussels",
    ownerEmail: "",
    ownerPassword: "",
    phoneNumber: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur inconnue");
        return;
      }
      router.push(`/dashboard/clients/${data.client.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="app-h1 mb-6">Onboarder un nouveau client</h1>

      <form onSubmit={submit} className="space-y-4">
        <div className="app-card space-y-4">
          <h2 className="app-h2">Infos client</h2>

          <Field label="Nom de l'entreprise *">
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Plomberie Dupont"
              className="app-input w-full"
            />
          </Field>

          <Field label="Fuseau horaire">
            <select
              value={form.timezone}
              onChange={(e) => update("timezone", e.target.value)}
              className="app-input w-full"
            >
              <option value="Europe/Brussels">Europe/Brussels</option>
              <option value="Europe/Paris">Europe/Paris</option>
              <option value="Europe/Amsterdam">Europe/Amsterdam</option>
            </select>
          </Field>
        </div>

        <div className="app-card space-y-4">
          <h2 className="app-h2">Compte propriétaire</h2>

          <Field label="Email *">
            <input
              type="email"
              required
              value={form.ownerEmail}
              onChange={(e) => update("ownerEmail", e.target.value)}
              placeholder="patron@plomberie-dupont.be"
              className="app-input w-full"
            />
          </Field>

          <Field label="Mot de passe provisoire *">
            <input
              type="password"
              required
              minLength={8}
              value={form.ownerPassword}
              onChange={(e) => update("ownerPassword", e.target.value)}
              placeholder="8 caractères minimum"
              className="app-input w-full"
            />
          </Field>
        </div>

        <div className="app-card space-y-4">
          <h2 className="app-h2">Numéro Twilio</h2>

          <Field label="Numéro E.164 *">
            <input
              type="tel"
              required
              value={form.phoneNumber}
              onChange={(e) => update("phoneNumber", e.target.value)}
              placeholder="+32499000001"
              className="app-input w-full"
            />
          </Field>
        </div>

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push("/dashboard/clients")}
            className="btn-ghost border border-white/10"
          >
            Annuler
          </button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? "Création…" : "Créer le client"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="app-label">{label}</label>
      {children}
    </div>
  );
}
