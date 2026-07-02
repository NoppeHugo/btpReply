"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

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

type WhitelistEntry = {
  id: string;
  number: string;
  label: string | null;
  createdAt: string;
};

type Template = {
  id?: string;
  key: string;
  body: string;
  language: "fr" | "nl";
};

// ── Constants ────────────────────────────────────────────────────────────────

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

const TEMPLATE_KEYS = [
  { key: "initial_sms", label: "SMS initial (après appel manqué)" },
  { key: "out_of_hours_sms", label: "SMS hors heures d'ouverture" },
];

// ── Section: Business Hours ───────────────────────────────────────────────────

function BusinessHoursSection() {
  const [hours, setHours] = useState<HoursEntry[]>(DEFAULT_HOURS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/v1/config/business-hours")
      .then((r) => r.json())
      .then((data: HoursEntry[]) => {
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
        {saved ? "Sauvegardé ✓" : saving ? "Sauvegarde…" : "Sauvegarder"}
      </button>
    </section>
  );
}

// ── Section: Whitelist ────────────────────────────────────────────────────────

function WhitelistSection() {
  const [entries, setEntries] = useState<WhitelistEntry[]>([]);
  const [number, setNumber] = useState("");
  const [label, setLabel] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    fetch("/api/v1/config/whitelist")
      .then((r) => r.json())
      .then((data: WhitelistEntry[]) => setEntries(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    if (!number.trim()) return;
    setAdding(true);
    try {
      await fetch("/api/v1/config/whitelist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: number.trim(), label: label.trim() || undefined }),
      });
      setNumber("");
      setLabel("");
      load();
    } finally {
      setAdding(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/v1/config/whitelist/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <section className="app-card">
      <h2 className="app-h2 mb-1">Numéros exclus</h2>
      <p className="mb-4 text-xs text-white/50">
        Ces numéros ne recevront jamais de SMS automatique (ex. concurrents, fournisseurs).
      </p>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="tel"
          placeholder="+32470123456"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          className="app-input flex-1"
        />
        <input
          type="text"
          placeholder="Label (optionnel)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="app-input sm:w-40"
        />
        <button
          onClick={add}
          disabled={adding || !number.trim()}
          className="btn-primary"
        >
          Ajouter
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-white/40">Aucun numéro exclu.</p>
      ) : (
        <ul className="space-y-1">
          {entries.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm"
            >
              <span className="font-mono text-white">{e.number}</span>
              {e.label && (
                <span className="ml-2 text-white/50">
                  {e.label === "opted_out" ? (
                    <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-400">
                      STOP opt-out
                    </span>
                  ) : (
                    e.label
                  )}
                </span>
              )}
              {e.label !== "opted_out" && (
                <button
                  onClick={() => remove(e.id)}
                  className="ml-auto text-xs text-red-400 hover:text-red-300"
                >
                  Supprimer
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Section: Templates ────────────────────────────────────────────────────────

function TemplatesSection() {
  const [templates, setTemplates] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/v1/config/templates")
      .then((r) => r.json())
      .then((data: Template[]) => {
        const map: Record<string, Record<string, string>> = {};
        for (const t of data) {
          if (!map[t.key]) map[t.key] = {};
          map[t.key][t.language] = t.body;
        }
        setTemplates(map);
      })
      .catch(() => {});
  }, []);

  function update(key: string, lang: "fr" | "nl", body: string) {
    setTemplates((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? {}), [lang]: body },
    }));
  }

  async function save() {
    setSaving(true);
    const payload: Template[] = [];
    for (const { key } of TEMPLATE_KEYS) {
      for (const lang of ["fr", "nl"] as const) {
        const body = templates[key]?.[lang];
        if (body) payload.push({ key, body, language: lang });
      }
    }
    try {
      await fetch("/api/v1/config/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="app-card">
      <h2 className="app-h2 mb-1">Modèles de SMS</h2>
      <p className="mb-4 text-xs text-white/50">
        Laissez vide pour utiliser le modèle par défaut. N&apos;utilisez jamais
        les mots «&nbsp;bot&nbsp;», «&nbsp;IA&nbsp;» ou «&nbsp;automatique&nbsp;».
      </p>

      <div className="space-y-6">
        {TEMPLATE_KEYS.map(({ key, label }) => (
          <div key={key}>
            <p className="mb-2 text-sm font-medium text-white/70">{label}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(["fr", "nl"] as const).map((lang) => (
                <div key={lang}>
                  <label className="mb-1 block text-xs font-medium text-white/50">
                    {lang === "fr" ? "Français" : "Nederlands"}
                  </label>
                  <textarea
                    rows={4}
                    value={templates[key]?.[lang] ?? ""}
                    onChange={(e) => update(key, lang, e.target.value)}
                    placeholder="Laissez vide pour utiliser le modèle par défaut…"
                    className="app-input w-full"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="btn-primary mt-4"
      >
        {saved ? "Sauvegardé ✓" : saving ? "Sauvegarde…" : "Sauvegarder"}
      </button>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

// ── Section: Paramètres (délai SMS + alertes) ─────────────────────────────────

type Settings = {
  initialSmsDelaySec: number;
  alertEmail: string | null;
  alertPhone: string | null;
};

function SettingsSection() {
  const [settings, setSettings] = useState<Settings>({
    initialSmsDelaySec: 30,
    alertEmail: "",
    alertPhone: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/config/settings")
      .then((r) => r.json())
      .then((j) => {
        const d = (j?.data ?? j) as Settings;
        if (d && typeof d.initialSmsDelaySec === "number") {
          setSettings({
            initialSmsDelaySec: d.initialSmsDelaySec,
            alertEmail: d.alertEmail ?? "",
            alertPhone: d.alertPhone ?? "",
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
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Échec de la sauvegarde");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
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
      </div>

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

      <button
        onClick={save}
        disabled={saving}
        className="btn-primary mt-4"
      >
        {saved ? "Sauvegardé ✓" : saving ? "Sauvegarde…" : "Sauvegarder"}
      </button>
    </section>
  );
}

export default function ConfigPage() {
  return (
    <div>
      <h1 className="mb-6 app-h1">Configuration</h1>
      <div className="space-y-6">
        <SettingsSection />
        <BusinessHoursSection />
        <WhitelistSection />
        <TemplatesSection />
      </div>
    </div>
  );
}
