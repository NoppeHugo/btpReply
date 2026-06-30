import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * P5-T1 : vérifie si un numéro est exclu des SMS automatiques
 * (liste blanche config + opt-out STOP).
 */
export async function isNumberExcluded(
  clientId: string,
  number: string
): Promise<boolean> {
  const entry = await db.whitelistEntry.findUnique({
    where: { clientId_number: { clientId, number } },
  });
  return entry !== null;
}

/**
 * P5-T2 : ajoute un numéro à la liste d'opt-out (STOP).
 * Idempotent — sans effet si déjà présent.
 */
export async function addToOptOutList(
  clientId: string,
  number: string
): Promise<void> {
  await db.whitelistEntry.upsert({
    where: { clientId_number: { clientId, number } },
    create: { clientId, number, label: "opted_out" },
    update: { label: "opted_out" },
  });

  logger.info({ clientId, number }, "Numéro ajouté à la liste d'opt-out (STOP)");
}
