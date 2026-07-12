"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, Trash2, Plus } from "lucide-react";
import { ContactImport } from "@/components/ContactImport";
import { BusinessHoursSection } from "@/components/config/BusinessHoursSection";
import { SettingsSection } from "@/components/config/SettingsSection";
import { EnablePushButton } from "@/components/EnablePushButton";
import { unwrap } from "@/lib/api/unwrap";

// ── Types ────────────────────────────────────────────────────────────────────

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

const TEMPLATE_KEYS = [
  { key: "initial_sms", label: "SMS initial (après appel manqué)" },
  { key: "out_of_hours_sms", label: "SMS hors heures d'ouverture" },
];

// ── Section: Whitelist ────────────────────────────────────────────────────────

function WhitelistSection() {
  const [entries, setEntries] = useState<WhitelistEntry[]>([]);
  const [number, setNumber] = useState("");
  const [label, setLabel] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    fetch("/api/v1/config/whitelist")
      .then((r) => r.json())
      .then((json) => {
        const data = unwrap<WhitelistEntry[]>(json);
        setEntries(Array.isArray(data) ? data : []);
      })
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
          <Plus className="size-4" /> Ajouter
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
                  className="ml-auto flex items-center gap-1 rounded-md p-1.5 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  aria-label="Supprimer"
                >
                  <Trash2 className="size-3.5" />
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
      .then((json) => {
        const data = unwrap<Template[]>(json);
        if (!Array.isArray(data)) return;
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

// ── Section: Notifications push ──────────────────────────────────────────────

function PushSection() {
  return (
    <section className="app-card">
      <h2 className="app-h2 mb-1">Notifications</h2>
      <p className="mb-4 text-xs text-white/50">
        Recevez une notification sur ce téléphone à chaque nouveau lead
        (fonctionne quand l&apos;app est installée).
      </p>
      <EnablePushButton />
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConfigPage() {
  return (
    <div>
      <h1 className="mb-6 app-h1">Configuration</h1>
      <div className="space-y-6">
        <SettingsSection />
        <PushSection />
        <ContactImport />
        <BusinessHoursSection />
        <WhitelistSection />
        <TemplatesSection />
      </div>
    </div>
  );
}
