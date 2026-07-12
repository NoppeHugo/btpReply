import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendInitialSmsNow } from "@/lib/calls/service";
import { sendAdminAlert } from "@/lib/alerts/admin";
import { InboundJobStatus } from "@/generated/prisma/client";

// File des SMS initiaux différés — même mécanique que la file entrante :
// claim par compare-and-swap (pas de double envoi multi-worker), retries
// bornés, jobs orphelins remis en file, alerte admin sur échec définitif.

const MAX_ATTEMPTS = 3;
const MAX_JOBS_PER_TICK = 20;
const STALE_PROCESSING_MS = 5 * 60 * 1000;

/**
 * Draine les jobs échus (sendAfter <= maintenant). Appelée périodiquement par
 * le worker. Retourne le nombre de jobs traités.
 */
export async function runOutboundQueue(): Promise<number> {
  await reclaimStaleJobs();

  let processed = 0;
  for (let i = 0; i < MAX_JOBS_PER_TICK; i++) {
    const job = await claimNextJob();
    if (!job) break;
    processed++;

    try {
      await sendInitialSmsNow(job.callId, job.clientId, job.callerNumber);
      await db.outboundSmsJob.update({
        where: { id: job.id },
        data: { status: InboundJobStatus.done },
      });
    } catch (err) {
      const attempts = job.attempts + 1;
      const failed = attempts >= MAX_ATTEMPTS;
      await db.outboundSmsJob.update({
        where: { id: job.id },
        data: {
          status: failed ? InboundJobStatus.failed : InboundJobStatus.pending,
          attempts,
          lastError: String(err),
        },
      });
      logger.error(
        { err, jobId: job.id, attempts, failed },
        "Job SMS initial en échec"
      );
      if (failed) {
        await sendAdminAlert(
          "SMS initial en échec définitif",
          `Job ${job.id} — appel ${job.callId}, client ${job.clientId}, destinataire ${job.callerNumber}\n\nErreur : ${String(err)}`
        );
      }
    }
  }

  return processed;
}

interface ClaimedJob {
  id: string;
  clientId: string;
  callId: string;
  callerNumber: string;
  attempts: number;
}

async function claimNextJob(): Promise<ClaimedJob | null> {
  const candidate = await db.outboundSmsJob.findFirst({
    where: {
      status: InboundJobStatus.pending,
      sendAfter: { lte: new Date() },
    },
    orderBy: { sendAfter: "asc" },
    select: {
      id: true,
      clientId: true,
      callId: true,
      callerNumber: true,
      attempts: true,
    },
  });
  if (!candidate) return null;

  const claimed = await db.outboundSmsJob.updateMany({
    where: { id: candidate.id, status: InboundJobStatus.pending },
    data: { status: InboundJobStatus.processing },
  });
  if (claimed.count === 0) return null;

  return candidate;
}

/** Remet en file les jobs `processing` orphelins (worker tué en plein envoi). */
async function reclaimStaleJobs(): Promise<void> {
  const threshold = new Date(Date.now() - STALE_PROCESSING_MS);
  const { count } = await db.outboundSmsJob.updateMany({
    where: {
      status: InboundJobStatus.processing,
      updatedAt: { lt: threshold },
    },
    data: { status: InboundJobStatus.pending },
  });
  if (count > 0) {
    logger.warn({ count }, "Jobs SMS initiaux orphelins remis en file");
  }
}
