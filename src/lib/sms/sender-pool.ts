import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const COOLDOWN_DAYS = Number(process.env.SENDER_COOLDOWN_DAYS ?? 7);
const ACTIVE_STATES = ["open", "qualified"] as const;

/**
 * Pool de numéros expéditeurs. Source : table SenderNumber (numéros actifs,
 * dans l'ordre de création). Repli sur l'env si la table est vide :
 * SMSTOOLS_SENDERS (séparés par des virgules) ou, à défaut, SMSTOOLS_SENDER.
 */
export async function getSenderPool(): Promise<string[]> {
  const rows = await db.senderNumber.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
    select: { number: true },
  });
  if (rows.length > 0) return rows.map((r) => r.number);

  const env = process.env.SMSTOOLS_SENDERS || process.env.SMSTOOLS_SENDER || "";
  return env
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Choisit le numéro expéditeur pour une nouvelle conversation avec `callerNumber`.
 *
 * Garantit qu'un même appelant n'a jamais deux conversations actives (dans la
 * fenêtre de cooldown) sur le MÊME numéro → le routage entrant par
 * (receiver, sender) reste sans ambiguïté.
 *
 * Stratégie, dans l'ordre :
 *  1. Un numéro sans autre conversation active pour cet appelant → idéal, zéro
 *     collision.
 *  2. Sinon (pool saturé pour cet appelant, cas rare) → le numéro le moins
 *     récemment actif avec lui → repli, collision improbable. Ne bloque jamais
 *     l'envoi.
 */
export async function assignSenderNumber(callerNumber: string): Promise<string> {
  const pool = await getSenderPool();
  if (pool.length === 0) {
    throw new Error(
      "Aucun numéro expéditeur disponible (table SenderNumber vide et SMSTOOLS_SENDER(S) manquant)"
    );
  }
  // Un seul numéro : rien à arbitrer (comportement historique, pas de requête).
  if (pool.length === 1) return pool[0];

  const cutoff = new Date(Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000);

  const active = await db.conversation.findMany({
    where: {
      callerNumber,
      senderNumber: { in: pool },
      state: { in: [...ACTIVE_STATES] },
      lastMessageAt: { gt: cutoff },
    },
    select: { senderNumber: true, lastMessageAt: true },
  });

  // Dernière activité par numéro, pour cet appelant.
  const lastActive = new Map<string, number>();
  for (const c of active) {
    if (!c.senderNumber) continue;
    const ts = c.lastMessageAt?.getTime() ?? 0;
    if (ts > (lastActive.get(c.senderNumber) ?? -1)) {
      lastActive.set(c.senderNumber, ts);
    }
  }

  // 1. Premier numéro totalement libre pour cet appelant.
  const free = pool.find((n) => !lastActive.has(n));
  if (free) return free;

  // 2. Repli : pool saturé pour cet appelant → numéro le moins récemment actif.
  let chosen = pool[0];
  let oldest = lastActive.get(chosen) ?? 0;
  for (const n of pool) {
    const ts = lastActive.get(n) ?? 0;
    if (ts < oldest) {
      chosen = n;
      oldest = ts;
    }
  }
  logger.warn(
    { callerNumber, chosen },
    "Pool d'expéditeurs saturé pour cet appelant — réutilisation du numéro le moins récent (collision résiduelle possible)"
  );
  return chosen;
}
