// Limiteur de débit en mémoire (fenêtre glissante). Suffisant pour un
// déploiement mono-instance ; à remplacer par un store partagé (Redis) si
// l'app passe en multi-instances.

const buckets = new Map<string, number[]>();

// Purge périodique paresseuse pour éviter la croissance illimitée de la Map.
let lastSweep = Date.now();
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;

function sweep(now: number, windowMs: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, hits] of buckets) {
    const alive = hits.filter((t) => now - t < windowMs);
    if (alive.length === 0) buckets.delete(key);
    else buckets.set(key, alive);
  }
}

/**
 * Enregistre une tentative et indique si elle est autorisée.
 * `key` doit préfixer l'usage (ex. "forgot:1.2.3.4") pour isoler les quotas.
 */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now, windowMs);

  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  return true;
}

/** Réinitialise un compteur (ex. après un login réussi). */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

/** Première IP de X-Forwarded-For (posé par Caddy), sinon "unknown". */
export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  return xff?.split(",")[0]?.trim() || "unknown";
}
