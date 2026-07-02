import { db } from "../../src/lib/db";
import { logger } from "../../src/lib/logger";
import {
  JOB_INITIAL_SMS,
  processInitialSms,
  type InitialSmsJobPayload,
} from "../../src/lib/calls/service";

const MAX_ATTEMPTS = 5;
// Un job réclamé mais non terminé (crash, échec) redevient éligible après ce délai.
const STALE_CLAIM_MS = 5 * 60_000;
const BATCH_SIZE = 20;

/**
 * F1 (audit) : traite les jobs persistants dus (SMS initial différé, etc.).
 * Appelé toutes les 10 s par le cron du worker. Le claim est atomique
 * (updateMany conditionnel) : deux ticks concurrents ne traitent jamais
 * le même job.
 */
export async function runScheduledJobs(): Promise<void> {
  const now = new Date();

  const due = await db.scheduledJob.findMany({
    where: {
      doneAt: null,
      runAt: { lte: now },
      attempts: { lt: MAX_ATTEMPTS },
      OR: [
        { claimedAt: null },
        { claimedAt: { lt: new Date(now.getTime() - STALE_CLAIM_MS) } },
      ],
    },
    orderBy: { runAt: "asc" },
    take: BATCH_SIZE,
  });

  for (const job of due) {
    const claimed = await db.scheduledJob.updateMany({
      where: { id: job.id, doneAt: null, claimedAt: job.claimedAt },
      data: { claimedAt: now, attempts: { increment: 1 } },
    });
    if (claimed.count === 0) continue; // réclamé par un autre tick

    try {
      if (job.type === JOB_INITIAL_SMS) {
        await processInitialSms(job.payload as unknown as InitialSmsJobPayload);
      } else {
        logger.warn({ jobId: job.id, type: job.type }, "Type de job inconnu — marqué traité");
      }

      await db.scheduledJob.update({
        where: { id: job.id },
        data: { doneAt: new Date(), lastError: null },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // claimedAt reste posé : nouvelle tentative après STALE_CLAIM_MS (backoff naturel).
      await db.scheduledJob.update({
        where: { id: job.id },
        data: { lastError: message },
      });
      logger.error({ err, jobId: job.id, type: job.type, attempts: job.attempts + 1 }, "Échec du job planifié");
    }
  }
}
