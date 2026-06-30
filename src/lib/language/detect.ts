// Mots distinctifs néerlandais courants dans un contexte SMS belge
const NL_PATTERN =
  /\b(hallo|goedag|goedemiddag|goedemorgen|goedeavond|bedankt|dank\s*u|dankuwel|graag|ik\s+heb|ik\s+wil|kunt\s+u|kunnen|heeft|hebben|mijn|voor\s+mij|alstublieft|alsjeblieft|ons\s+bel|terugbel|afspraak|lekkage|loodgieter|elektricien|aannemer)\b/i;

/**
 * P5-T5 : détection FR/NL basique sur un texte court (SMS).
 * Par défaut → "fr" si aucun marqueur NL détecté.
 */
export function detectLanguage(text: string): "fr" | "nl" {
  return NL_PATTERN.test(text) ? "nl" : "fr";
}
