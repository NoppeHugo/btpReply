"use client";

import { useState, useSyncExternalStore } from "react";

// Import du répertoire pour construire la whitelist (numéros connus = pas de SMS
// auto). Trois voies cross-platform, sans app native :
//  - Android : Contact Picker API (navigator.contacts) — natif web.
//  - iOS/desktop : upload d'un fichier vCard (.vcf).
//  - iPhone : Raccourci Apple (import massif) via un token d'import personnalisé.
// Voir docs/sms-sender-pool.md et le plan whitelist contacts.

// La Contact Picker API n'est pas typée dans lib.dom : on déclare le minimum.
interface ContactInfo {
  tel?: string[];
  name?: string[];
}
interface ContactsManager {
  select(props: string[], opts?: { multiple?: boolean }): Promise<ContactInfo[]>;
}
type NavigatorWithContacts = Navigator & { contacts?: ContactsManager };

type ImportResult = { added: number; skipped: number; invalid: number };

async function postNumbers(
  numbers: string[],
  source: "contacts_import" | "vcard"
): Promise<ImportResult | null> {
  const res = await fetch("/api/v1/config/whitelist/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ numbers, source }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return (json?.data ?? json) as ImportResult;
}

/** Extrait les numéros des lignes TEL d'un contenu vCard. */
function parseVCardNumbers(text: string): string[] {
  return text
    .split(/\r?\n/)
    .filter((line) => /^(item\d+\.)?TEL/i.test(line.trim()))
    .map((line) => line.slice(line.lastIndexOf(":") + 1).trim())
    .filter(Boolean);
}

// Présence de la Contact Picker API (Android) — état navigateur externe lu sans
// setState en effet (snapshot serveur stable → pas de mismatch d'hydratation).
function useHasContactPicker(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => typeof (navigator as NavigatorWithContacts).contacts?.select === "function",
    () => false
  );
}

export function ContactImport() {
  const hasPicker = useHasContactPicker();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shortcut, setShortcut] = useState<{ token: string; importUrl: string } | null>(null);

  function report(r: ImportResult | null) {
    if (r) {
      setResult(r);
      setError(null);
    } else {
      setError("Échec de l'import. Réessayez.");
    }
  }

  async function pickContacts() {
    setBusy(true);
    setError(null);
    try {
      const nav = navigator as NavigatorWithContacts;
      const contacts = (await nav.contacts?.select(["tel"], { multiple: true })) ?? [];
      const numbers = contacts.flatMap((c) => c.tel ?? []);
      if (numbers.length === 0) {
        setError("Aucun numéro sélectionné.");
        return;
      }
      report(await postNumbers(numbers, "contacts_import"));
    } catch {
      setError("Sélection annulée ou refusée.");
    } finally {
      setBusy(false);
    }
  }

  async function onVCard(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const numbers = parseVCardNumbers(await file.text());
      if (numbers.length === 0) {
        setError("Aucun numéro trouvé dans ce fichier.");
        return;
      }
      report(await postNumbers(numbers, "vcard"));
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function loadShortcut() {
    setError(null);
    try {
      const res = await fetch("/api/v1/config/whitelist/import");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setShortcut((json?.data ?? json) as { token: string; importUrl: string });
    } catch {
      setError("Impossible de générer le lien du raccourci.");
    }
  }

  // Lien iCloud du raccourci Apple (artefact one-time, configurable).
  const shortcutUrl = process.env.NEXT_PUBLIC_IOS_SHORTCUT_URL;

  return (
    <section className="app-card">
      <h2 className="app-h2 mb-1">Protéger mes contacts</h2>
      <p className="mb-4 text-xs text-white/50">
        Importez votre répertoire : les personnes que vous connaissez déjà ne
        recevront jamais de SMS automatique (moins de coûts, zéro message inutile).
      </p>

      <div className="space-y-4">
        {/* Android : Contact Picker natif */}
        {hasPicker && (
          <div>
            <button
              type="button"
              onClick={pickContacts}
              disabled={busy}
              className="btn-primary"
            >
              {busy ? "Import…" : "Importer mes contacts"}
            </button>
            <p className="mt-1 text-[11px] text-white/40">
              Sélectionnez les contacts (ou tout) à exclure des SMS.
            </p>
          </div>
        )}

        {/* iPhone : Raccourci Apple */}
        <div>
          <p className="mb-1 text-sm font-medium text-white/70">iPhone — Raccourci</p>
          <p className="mb-2 text-[11px] text-white/40">
            Installez le raccourci, lancez-le, et collez le code ci-dessous quand il
            le demande. Vos contacts sont alors protégés en un tap.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {shortcutUrl && (
              <a href={shortcutUrl} target="_blank" rel="noreferrer" className="btn-primary">
                Ajouter le raccourci
              </a>
            )}
            <button type="button" onClick={loadShortcut} className="btn-ghost border border-white/10">
              Obtenir mon code
            </button>
          </div>
          {shortcut && (
            <code className="mt-2 block break-all rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-white/70">
              {shortcut.token}
            </code>
          )}
        </div>

        {/* iOS/desktop : upload vCard */}
        <div>
          <p className="mb-1 text-sm font-medium text-white/70">
            Ou importer un fichier de contacts (.vcf)
          </p>
          <input
            type="file"
            accept=".vcf,text/vcard"
            onChange={onVCard}
            disabled={busy}
            className="text-xs text-white/60"
          />
        </div>
      </div>

      {result && (
        <p className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
          {result.added} numéro(s) protégé(s){result.skipped > 0 && `, ${result.skipped} déjà présent(s)`}
          {result.invalid > 0 && `, ${result.invalid} ignoré(s)`}.
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
