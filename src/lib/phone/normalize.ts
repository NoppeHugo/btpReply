import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

// Normalisation des numéros vers E.164. Le numéro entrant Twilio est déjà en
// E.164 ; la whitelist doit l'être aussi pour matcher dans isNumberExcluded.
// Les numéros importés du répertoire arrivent en formats crades (04.., 0032,
// espaces, /) → on les nettoie avec la région belge par défaut.

const DEFAULT_COUNTRY: CountryCode = "BE";

/** Renvoie le numéro en E.164 (ex. +32470123456) ou null si invalide. */
export function normalizeToE164(
  raw: string,
  defaultCountry: CountryCode = DEFAULT_COUNTRY
): string | null {
  if (!raw) return null;
  try {
    const parsed = parsePhoneNumberFromString(raw.trim(), defaultCountry);
    if (parsed && parsed.isValid()) return parsed.number;
    return null;
  } catch {
    return null;
  }
}

/**
 * Normalise une liste de numéros bruts : E.164 + dédup. Retourne les numéros
 * valides uniques et le nombre d'entrées invalides écartées.
 */
export function normalizeMany(
  raws: string[],
  defaultCountry: CountryCode = DEFAULT_COUNTRY
): { valid: string[]; invalid: number } {
  const set = new Set<string>();
  let invalid = 0;
  for (const raw of raws) {
    const n = normalizeToE164(raw, defaultCountry);
    if (n) set.add(n);
    else invalid++;
  }
  return { valid: [...set], invalid };
}
