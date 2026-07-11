"use client";

import { useState, useEffect } from "react";
import { Check } from "lucide-react";
import { unwrap } from "@/lib/api/unwrap";

type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

type HoursEntry = {
  dayOfWeek: DayOfWeek;
  openTime: string;
  closeTime: string;
  closed: boolean;
};

const DAYS: { key: DayOfWeek; label: string }[] = [
  { key: "monday", label: "Lundi" },
  { key: "tuesday", label: "Mardi" },
  { key: "wednesday", label: "Mercredi" },
  { key: "thursday", label: "Jeudi" },
  { key: "friday", label: "Vendredi" },
  { key: "saturday", label: "Samedi" },
  { key: "sunday", label: "Dimanche" },
];

const DEFAULT_HOURS: HoursEntry[] = DAYS.map((d) => ({
  dayOfWeek: d.key,
  openTime: "08:00",
  closeTime: "18:00",
  closed: d.key === "saturday" || d.key === "sunday",
}));

/** Réutilisée par la page Config et le wizard d'onboarding. */
export function BusinessHoursSection({ onSaved }: { onSaved?: () => void }) {
  const [hours, setHours] = useState<HoursEntry[]>(DEFAULT_HOURS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/v1/config/business-hours")
      .then((r) => r.json())
      .then((json) => {
        const data = unwrap<HoursEntry[]>(json);
        if (Array.isArray(data) && data.length > 0) {
          const merged = DAYS.map((d) => {
            const found = data.find((e) => e.dayOfWeek === d.key);
            return (
              found ?? {
                dayOfWeek: d.key,
                openTime: "08:00",
                closeTime: "18:00",
                closed: false,
              }
            );
          });
          setHours(merged);
        }
      })
      .catch(() => {});
  }, []);

  function updateDay(idx: number, patch: Partial<HoursEntry>) {
    setHours((prev) => prev.map((h, i) => (i === idx ? { ...h, ...patch } : h)));
  }

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/v1/config/business-hours", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hours),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="app-card">
      <h2 className="app-h2 mb-4">Heures d&apos;ouverture</h2>
      <div className="space-y-2">
        {hours.map((h, i) => (
          <div key={h.dayOfWeek} className="flex flex-wrap items-center gap-3">
            <span className="w-24 text-sm text-white/60">
              {DAYS[i]?.label}
            </span>
            <label className="flex items-center gap-1.5 text-sm text-white/50">
              <input
                type="checkbox"
                checked={h.closed}
                onChange={(e) => updateDay(i, { closed: e.target.checked })}
                className="rounded"
              />
              Fermé
            </label>
            {!h.closed && (
              <>
                <input
                  type="time"
                  value={h.openTime}
                  onChange={(e) => updateDay(i, { openTime: e.target.value })}
                  className="app-input"
                />
                <span className="text-sm text-white/40">–</span>
                <input
                  type="time"
                  value={h.closeTime}
                  onChange={(e) => updateDay(i, { closeTime: e.target.value })}
                  className="app-input"
                />
              </>
            )}
          </div>
        ))}
      </div>
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
