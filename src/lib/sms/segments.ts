// Maîtrise du coût SMS : garantir qu'un SMS sortant tient en 1 seul segment.
// Un segment = 160 caractères en GSM-7. Un seul caractère hors GSM-7 (emoji,
// guillemet courbe, ê/â/î…) fait basculer TOUT le message en UCS-2, où la
// limite tombe à 70 → 2 segments quasi garantis. On assainit donc en amont.

// Caractères de base GSM-7 (comptent pour 1).
const GSM7_BASE = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ ÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡" +
    "ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"
);

// Caractères de l'extension GSM-7 (comptent pour 2).
const GSM7_EXT = new Set("^{}\\[~]|€");

// Limites de segment.
const GSM7_SINGLE = 160;
const GSM7_MULTI = 153; // 7 octets d'en-tête UDH par segment concaténé
const UCS2_SINGLE = 70;
const UCS2_MULTI = 67;

// Translittération des caractères hors-GSM-7 fréquents en FR/NL vers un
// équivalent GSM-7, pour rester en 1 segment sans dénaturer le message.
const TRANSLITERATIONS: Record<string, string> = {
  // Guillemets / apostrophes typographiques
  "‘": "'", "’": "'", "‚": "'", "′": "'",
  "“": '"', "”": '"', "„": '"', "«": '"', "»": '"',
  // Tirets et points de suspension
  "–": "-", "—": "-", "―": "-", "…": "...",
  // Accents circonflexes / trémas absents du GSM-7
  "â": "a", "ê": "e", "î": "i", "ô": "o", "û": "u",
  "ë": "e", "ï": "i", "ü": "u", // ü est en GSM-7 mais on garde ë/ï → e/i
  "Â": "A", "Ê": "E", "Î": "I", "Ô": "O", "Û": "U", "Ë": "E", "Ï": "I",
  "œ": "oe", "Œ": "OE",
  // ç minuscule n'existe PAS en GSM-7 (seul Ç majuscule y est) → bascule UCS-2
  "ç": "c",
  // Espaces spéciaux
  " ": " ", " ": " ", " ": " ",
};

/**
 * Assainit un texte pour maximiser sa compatibilité GSM-7 :
 * - translittère les caractères courants hors-GSM-7 (typographie, accents) ;
 * - supprime tout ce qui reste hors-GSM-7 (emoji, symboles exotiques).
 */
export function sanitizeToGsm7(input: string): string {
  let out = "";
  for (const ch of input) {
    if (GSM7_BASE.has(ch) || GSM7_EXT.has(ch)) {
      out += ch;
      continue;
    }
    const replacement = TRANSLITERATIONS[ch];
    if (replacement !== undefined) {
      out += replacement;
      continue;
    }
    // Caractère hors-GSM-7 sans équivalent (emoji, etc.) → supprimé.
  }
  return out;
}

interface SegmentInfo {
  encoding: "GSM-7" | "UCS-2";
  units: number; // nb d'unités facturées (chars GSM-7, avec ext=2 ; ou code units UCS-2)
  segments: number;
}

/**
 * Calcule l'encodage et le nombre de segments d'un SMS, à la manière de Twilio.
 * N'assainit pas — reflète le coût réel du texte tel quel.
 */
export function computeSegments(text: string): SegmentInfo {
  let units = 0;
  let isGsm7 = true;

  for (const ch of text) {
    if (GSM7_BASE.has(ch)) {
      units += 1;
    } else if (GSM7_EXT.has(ch)) {
      units += 2;
    } else {
      isGsm7 = false;
      break;
    }
  }

  if (!isGsm7) {
    // UCS-2 : on compte en code units UTF-16 (surrogate pairs = 2).
    let codeUnits = 0;
    for (const ch of text) codeUnits += ch.length;
    return {
      encoding: "UCS-2",
      units: codeUnits,
      segments: codeUnits <= UCS2_SINGLE ? 1 : Math.ceil(codeUnits / UCS2_MULTI),
    };
  }

  return {
    encoding: "GSM-7",
    units,
    segments: units <= GSM7_SINGLE ? 1 : Math.ceil(units / GSM7_MULTI),
  };
}

/**
 * Assainit puis, si le résultat déborde d'un segment, tronque à la limite de
 * mot pour tenir en un seul segment GSM-7 (160 unités). Garantit 1 segment.
 */
export function enforceSingleSegment(input: string): {
  body: string;
  truncated: boolean;
} {
  const sanitized = sanitizeToGsm7(input).trim();

  if (computeSegments(sanitized).segments <= 1) {
    return { body: sanitized, truncated: false };
  }

  // Tronquer en respectant le coût réel (les caractères d'extension = 2).
  let units = 0;
  let cut = sanitized.length;
  for (let i = 0; i < sanitized.length; i++) {
    const cost = GSM7_EXT.has(sanitized[i]) ? 2 : 1;
    if (units + cost > GSM7_SINGLE) {
      cut = i;
      break;
    }
    units += cost;
  }

  let body = sanitized.slice(0, cut).trimEnd();
  // Reculer jusqu'à la dernière frontière de mot pour ne pas couper un mot.
  const lastSpace = body.lastIndexOf(" ");
  if (lastSpace > GSM7_SINGLE * 0.6) {
    body = body.slice(0, lastSpace).trimEnd();
  }

  return { body, truncated: true };
}
