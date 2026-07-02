// Coordonnées publiques du site — source unique (W1 audit : adresse unifiée).

export const SITE_NAME = "Rappl";
export const SITE_DOMAIN = "rappl.be";
export const SITE_URL = `https://${SITE_DOMAIN}`;

export const CONTACT_EMAIL = "contact@rappl.be";

// Numéro affiché sur le site (format lisible). Laisser vide tant qu'aucun
// numéro public n'existe : le CTA téléphone ne s'affiche que s'il est rempli.
// Astuce vente : mettez ici un numéro Rappl et ne décrochez pas — le prospect
// vit la démo en vrai.
export const CONTACT_PHONE = "";
export const CONTACT_PHONE_HREF = `tel:${CONTACT_PHONE.replace(/[^+\d]/g, "")}`;

// Informations société pour les mentions légales — à compléter à la
// constitution de la société.
export const COMPANY_LEGAL_NAME = "[À COMPLÉTER — dénomination sociale]";
export const COMPANY_BCE = "[À COMPLÉTER — n° BCE]";
export const COMPANY_ADDRESS = "[À COMPLÉTER — siège social]";
