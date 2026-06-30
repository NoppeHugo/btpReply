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
      <h1 className="mb-6 text-xl font-semibold text-gray-900">
        Onboarder un nouveau client
      </h1>

      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
          <h2 className="font-medium text-gray-700">Infos client</h2>

          <Field label="Nom de l'entreprise *">
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Plomberie Dupont"
              className="input"
            />
          </Field>

          <Field label="Fuseau horaire">
            <select
              value={form.timezone}
              onChange={(e) => update("timezone", e.target.value)}
              className="input"
            >
              <option value="Europe/Brussels">Europe/Brussels</option>
              <option value="Europe/Paris">Europe/Paris</option>
              <option value="Europe/Amsterdam">Europe/Amsterdam</option>
            </select>
          </Field>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
          <h2 className="font-medium text-gray-700">Compte propriétaire</h2>

          <Field label="Email *">
            <input
              type="email"
              required
              value={form.ownerEmail}
              onChange={(e) => update("ownerEmail", e.target.value)}
              placeholder="patron@plomberie-dupont.be"
              className="input"
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
              className="input"
            />
          </Field>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
          <h2 className="font-medium text-gray-700">Numéro Twilio</h2>

          <Field label="Numéro E.164 *">
            <input
              type="tel"
              required
              value={form.phoneNumber}
              onChange={(e) => update("phoneNumber", e.target.value)}
              placeholder="+32499000001"
              className="input"
            />
          </Field>
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push("/dashboard/clients")}
            className="rounded-md border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Création…" : "Créer le client"}
          </button>
        </div>
      </form>

      <style jsx>{`
        .input {
          width: 100%;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 6px 12px;
          font-size: 14px;
          outline: none;
        }
        .input:focus {
          ring: 1px solid #3b82f6;
          border-color: #3b82f6;
        }
      `}</style>
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
      <label className="mb-1 block text-sm font-medium text-gray-600">
        {label}
      </label>
      {children}
    </div>
  );
}
