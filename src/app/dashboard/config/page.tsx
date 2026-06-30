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
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="mb-4 font-semibold text-gray-900">Heures d'ouverture</h2>
      <div className="space-y-2">
        {hours.map((h, i) => (
          <div key={h.dayOfWeek} className="flex items-center gap-3">
            <span className="w-24 text-sm text-gray-600">
              {DAYS[i]?.label}
            </span>
            <label className="flex items-center gap-1.5 text-sm text-gray-500">
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
                  className="rounded border border-gray-200 px-2 py-1 text-sm"
                />
                <span className="text-sm text-gray-400">–</span>
                <input
                  type="time"
                  value={h.closeTime}
                  onChange={(e) => updateDay(i, { closeTime: e.target.value })}
                  className="rounded border border-gray-200 px-2 py-1 text-sm"
                />
              </>
            )}
          </div>
        ))}
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="mt-4 rounded-md bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
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
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="mb-1 font-semibold text-gray-900">Numéros exclus</h2>
      <p className="mb-4 text-xs text-gray-500">
        Ces numéros ne recevront jamais de SMS automatique (ex. concurrents, fournisseurs).
      </p>

      <div className="mb-4 flex gap-2">
        <input
          type="tel"
          placeholder="+32470123456"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          className="flex-1 rounded border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <input
          type="text"
          placeholder="Label (optionnel)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-40 rounded border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          onClick={add}
          disabled={adding || !number.trim()}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Ajouter
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-gray-400">Aucun numéro exclu.</p>
      ) : (
        <ul className="space-y-1">
          {entries.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm"
            >
              <span className="font-mono">{e.number}</span>
              {e.label && (
                <span className="ml-2 text-gray-500">
                  {e.label === "opted_out" ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
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
                  className="ml-auto text-xs text-red-500 hover:text-red-700"
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
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="mb-1 font-semibold text-gray-900">Modèles de SMS</h2>
      <p className="mb-4 text-xs text-gray-500">
        Laissez vide pour utiliser le modèle par défaut. N'utilisez jamais les mots "bot", "IA" ou "automatique".
      </p>

      <div className="space-y-6">
        {TEMPLATE_KEYS.map(({ key, label }) => (
          <div key={key}>
            <p className="mb-2 text-sm font-medium text-gray-700">{label}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(["fr", "nl"] as const).map((lang) => (
                <div key={lang}>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    {lang === "fr" ? "Français" : "Nederlands"}
                  </label>
                  <textarea
                    rows={4}
                    value={templates[key]?.[lang] ?? ""}
                    onChange={(e) => update(key, lang, e.target.value)}
                    placeholder="Laissez vide pour utiliser le modèle par défaut…"
                    className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
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
        className="mt-4 rounded-md bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saved ? "Sauvegardé ✓" : saving ? "Sauvegarde…" : "Sauvegarder"}
      </button>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConfigPage() {
  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Configuration</h1>
      <div className="space-y-6">
        <BusinessHoursSection />
        <WhitelistSection />
        <TemplatesSection />
      </div>
    </div>
  );
}
