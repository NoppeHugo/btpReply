import crypto from "crypto";

// Token de (ré)initialisation de mot de passe, sans table dédiée : le payload
// (userId + expiration) est signé HMAC avec AUTH_SECRET **et le passwordHash
// actuel** de l'utilisateur. Dès que le mot de passe change, tous les tokens
// émis avant deviennent invalides (usage unique de fait). Sert aussi de lien
// d'invitation pour un compte créé sans mot de passe (passwordHash null).

const RESET_TTL_MS = 1000 * 60 * 60; // 1 h — reset « mot de passe oublié »
export const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 jours — invitation

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET manquant (signature du token de reset)");
  return s;
}

function sign(data: string, passwordHash: string | null): string {
  return crypto
    .createHmac("sha256", secret())
    .update(`${passwordHash ?? "no-password"}.${data}`)
    .digest("base64url");
}

/** Crée un token `<payload>.<signature>` pour cet utilisateur. */
export function createResetToken(
  userId: string,
  passwordHash: string | null,
  ttlMs = RESET_TTL_MS
): string {
  const exp = Date.now() + ttlMs;
  const b64 = Buffer.from(`${userId}.${exp}`).toString("base64url");
  return `${b64}.${sign(b64, passwordHash)}`;
}

/** Extrait le userId du token SANS vérifier la signature (pour charger le hash). */
export function peekResetToken(token: string): string | null {
  const [b64] = token.split(".");
  if (!b64) return null;
  const [userId] = Buffer.from(b64, "base64url").toString().split(".");
  return userId || null;
}

/**
 * Vérifie signature (liée au passwordHash actuel) + expiration.
 * Retourne le userId, ou null si invalide/expiré/déjà utilisé.
 */
export function verifyResetToken(
  token: string,
  passwordHash: string | null
): string | null {
  if (!token) return null;
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;

  const expected = sign(b64, passwordHash);
  const given = Buffer.from(sig);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
    return null;
  }

  const [userId, expStr] = Buffer.from(b64, "base64url").toString().split(".");
  const exp = Number(expStr);
  if (!userId || !Number.isFinite(exp) || Date.now() > exp) return null;
  return userId;
}
