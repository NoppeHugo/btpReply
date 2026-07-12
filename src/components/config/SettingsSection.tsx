"use client";

import { useState, useEffect } from "react";
import { Check } from "lucide-react";
import { unwrap } from "@/lib/api/unwrap";

type Settings = {
  initialSmsDelaySec: number;
  alertEmail: string | null;
  alertPhone: string | null;
  avgCustomerValue: number;
};

/** Réutilisée par la page Config et le wizard d'onboarding. */
export function SettingsSection({ onSaved }: { onSaved?: () => void }) {
  const [settings, setSettings] = useState<Settings>({
    initialSmsDelaySec: 30,
    alertEmail: "",
    alertPhone: "",
    avgCustomerValue: 800,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/config/settings")
      .then((r) => r.json())
      .then((j) => {
        const d = unwrap<Settings>(j);
        if (d && typeof d.initialSmsDelaySec === "number") {
          setSettings({
            initialSmsDelaySec: d.initialSmsDelaySec,
            alertEmail: d.alertEmail ?? "",
            alertPhone: d.alertPhone ?? "",
            avgCustomerValue: d.avgCustomerValue ?? 800,
          });
        }
      })
      .catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/config/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initialSmsDelaySec: Number(settings.initialSmsDelaySec),
          alertEmail: settings.alertEmail || "",
          alertPhone: settings.alertPhone || "",
          avgCustomerValue: Number(settings.avgCustomerValue),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Échec de la sauvegarde");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="app-card">
      <h2 className="app-h2 mb-1">Paramètres</h2>
      <p className="mb-4 text-xs text-white/50">
        Délai avant l&apos;envoi du premier SMS et coordonnées de réception des alertes.
      </p>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-white/70">
            Délai avant le premier SMS (secondes)
          </label>
          <input
            type="number"
            min={0}
            max={600}
            value={settings.initialSmsDelaySec}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                initialSmsDelaySec: Number(e.target.value),
              }))
            }
            className="app-input w-32"
          />
          <p className="mt-1 text-[11px] text-white/40">
            Laisser le temps de décrocher soi-même avant l&apos;envoi (défaut : 30 s).
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-white/70">
            Email de réception des alertes
          </label>
          <input
            type="email"
            placeholder="vous@exemple.be"
            value={settings.alertEmail ?? ""}
            onChange={(e) =>
              setSettings((s) => ({ ...s, alertEmail: e.target.value }))
            }
            className="app-input w-full max-w-sm"
          />
          <p className="mt-1 text-[11px] text-white/40">
            Vide = envoyé au(x) compte(s) propriétaire(s) du client.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-white/70">
            Numéro pour alerte SMS (optionnel)
          </label>
          <input
            type="tel"
            placeholder="+32470123456"
            value={settings.alertPhone ?? ""}
            onChange={(e) =>
              setSettings((s) => ({ ...s, alertPhone: e.target.value }))
            }
            className="app-input w-full max-w-sm"
          />
          <p className="mt-1 text-[11px] text-white/40">
            Si renseigné, un SMS d&apos;alerte est aussi envoyé à ce numéro pour chaque lead.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-white/70">
            Valeur moyenne d&apos;un client (€)
          </label>
          <input
            type="number"
            min={0}
            max={100000}
            value={settings.avgCustomerValue}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                avgCustomerValue: Number(e.target.value),
              }))
            }
            className="app-input w-32"
          />
          <p className="mt-1 text-[11px] text-white/40">
            Sert au calcul du chiffre d&apos;affaires estimé sur la page ROI.
          </p>
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

      <button
        onClick={save}
        disabled={saving}
        className="btn-primary mt-4"
      >
        {saved ? (
          <>
            <Check className="size-4" /> Sauvegardé
          </>
        ) : saving ? (
          "Sauvegarde…"
        ) : (
          "Sauvegarder"
        )}
      </button>
    </section>
  );
}
