import crypto from "crypto";

// Token d'import signé, porté par le Raccourci Apple (qui ne peut pas envoyer le
// cookie de session). Généré côté PWA pendant l'onboarding, il encode le clientId
// + une expiration et est signé HMAC avec AUTH_SECRET. Aucune colonne DB requise.

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 jours

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET manquant (signature du token d'import)");
  return s;
}

function sign(data: string): string {
  return crypto.createHmac("sha256", secret()).update(data).digest("base64url");
}

/** Crée un token `<payload>.<signature>` valable ttlMs (défaut 7 jours). */
export function createImportToken(clientId: string, ttlMs = DEFAULT_TTL_MS): string {
  const exp = Date.now() + ttlMs;
  const b64 = Buffer.from(`${clientId}.${exp}`).toString("base64url");
  return `${b64}.${sign(b64)}`;
}

/** Vérifie signature + expiration. Retourne le clientId, ou null si invalide. */
export function verifyImportToken(token: string): string | null {
  if (!token) return null;
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;

  const expected = sign(b64);
  const given = Buffer.from(sig);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
    return null;
  }

  const [clientId, expStr] = Buffer.from(b64, "base64url").toString().split(".");
  const exp = Number(expStr);
  if (!clientId || !Number.isFinite(exp) || Date.now() > exp) return null;
  return clientId;
}
