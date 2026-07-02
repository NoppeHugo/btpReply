// S3 (audit) : détection d'opt-out / opt-in élargie FR + NL.
// L'opt-out doit être respecté immédiatement (règle légale BE/FR) : on matche
// le message entier OU son premier mot, après normalisation (casse, accents,
// ponctuation), pour couvrir « Stop. », « STOP SVP », « arrêt », « uitschrijven »…

const OPT_OUT_KEYWORDS = new Set([
  // FR
  "stop",
  "arret",
  "desinscription",
  "desabonnement",
  "desinscrire",
  "desabonner",
  // NL
  "stoppen",
  "uitschrijven",
  "afmelden",
  "uit",
]);

// Opt-in (réinscription) : match strict sur le message entier uniquement,
// pour éviter tout faux positif.
const OPT_IN_KEYWORDS = new Set(["start", "unstop", "hervat", "aanmelden"]);

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // retire les accents (diacritiques combinants)
    .replace(/[.,!?;:'"()\-_/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True si le message est une demande de désinscription (STOP & variantes). */
export function isOptOutMessage(body: string): boolean {
  const normalized = normalize(body);
  if (!normalized) return false;
  if (OPT_OUT_KEYWORDS.has(normalized)) return true;
  const firstWord = normalized.split(" ")[0];
  return OPT_OUT_KEYWORDS.has(firstWord);
}

/** True si le message est une demande de réinscription (START & variantes). */
export function isOptInMessage(body: string): boolean {
  const normalized = normalize(body);
  return OPT_IN_KEYWORDS.has(normalized);
}
