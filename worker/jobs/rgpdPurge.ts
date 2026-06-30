import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { logger } from "../../src/lib/logger";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

const RETENTION_MONTHS = 12;

/**
 * P7-T4 / RGPD : supprime toutes les données personnelles plus anciennes que
 * RETENTION_MONTHS mois.
 * Ordre de suppression respecte les FK : Messages → Leads → Conversations → Calls
 */
export async function runRgpdPurge(): Promise<void> {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);

  logger.info({ cutoff }, "RGPD purge démarrée");

  try {
    // 1. Trouver les conversations à purger
    const oldConvIds = await db.conversation.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true, callId: true },
    });

    if (oldConvIds.length === 0) {
      logger.info("RGPD purge : aucune donnée à supprimer");
      return;
    }

    const convIds = oldConvIds.map((c) => c.id);
    const callIds = oldConvIds.map((c) => c.callId);

    // 2. Supprimer les messages
    const { count: msgCount } = await db.message.deleteMany({
      where: { conversationId: { in: convIds } },
    });

    // 3. Supprimer les leads
    const { count: leadCount } = await db.lead.deleteMany({
      where: { conversationId: { in: convIds } },
    });

    // 4. Supprimer les conversations
    const { count: convCount } = await db.conversation.deleteMany({
      where: { id: { in: convIds } },
    });

    // 5. Supprimer les appels orphelins
    const { count: callCount } = await db.call.deleteMany({
      where: { id: { in: callIds } },
    });

    logger.info(
      { msgCount, leadCount, convCount, callCount, cutoff },
      "RGPD purge terminée"
    );
  } catch (err) {
    logger.error({ err }, "Erreur lors de la purge RGPD");
    throw err;
  }
}
