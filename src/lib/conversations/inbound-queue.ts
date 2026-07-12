import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { processInboundSms } from "./inbound";
import { sendAdminAlert } from "@/lib/alerts/admin";
import { InboundJobStatus } from "@/generated/prisma/client";

// Nombre max d'échecs avant d'abandonner un job (passage en `failed`).
const MAX_ATTEMPTS = 3;
// Garde-fou : on ne draine qu'un lot borné par tick pour ne pas monopoliser le
// worker si la file est longue (le tick suivant reprendra le reste).
const MAX_JOBS_PER_TICK = 20;
// Un job resté `processing` au-delà de ce délai est considéré orphelin (worker
// tué en plein traitement) et remis en file. Sûr car `processInboundSms` est
// idempotent (garde sur `providerMessageId`).
const STALE_PROCESSING_MS = 5 * 60 * 1000;

export interface EnqueueInboundInput {
  callerNumber: string;
  receiver?: string;
  messageBody: string;
  providerMessageId?: string;
}

export type EnqueueResult = "enqueued" | "duplicate" | "no_caller";

/**
 * Met un SMS entrant en file. Idempotent : un `providerMessageId` déjà en file
 * (retry webhook de Twilio) n'est pas ré-enfilé. Ne lève jamais pour un
 * doublon afin que le webhook acquitte toujours (HTTP 200).
 */
export async function enqueueInboundSms(
  input: EnqueueInboundInput
): Promise<EnqueueResult> {
  if (!input.callerNumber) {
    logger.warn("SMS entrant Twilio sans expéditeur — non mis en file");
    return "no_caller";
  }

  // Court-circuit du cas courant : job déjà présent pour ce message.
  if (input.providerMessageId) {
    const existing = await db.inboundSmsJob.findUnique({
      where: { providerMessageId: input.providerMessageId },
      select: { id: true },
    });
    if (existing) {
      logger.info(
        { providerMessageId: input.providerMessageId },
        "SMS entrant déjà en file (retry Twilio) — ignoré"
      );
      return "duplicate";
    }
  }

  try {
    await db.inboundSmsJob.create({
      data: {
        callerNumber: input.callerNumber,
        receiver: input.receiver,
        body: input.messageBody,
        providerMessageId: input.providerMessageId,
      },
    });
    return "enqueued";
  } catch (err) {
    // Filet de sécurité pour la course entre deux retries simultanés : la
    // contrainte unique sur providerMessageId rejette le second insert (P2002).
    if (isUniqueViolation(err)) {
      logger.info(
        { providerMessageId: input.providerMessageId },
        "SMS entrant déjà en file (course de retries) — ignoré"
      );
      return "duplicate";
    }
    throw err;
  }
}

/**
 * Draine la file : réclame et traite jusqu'à MAX_JOBS_PER_TICK jobs en attente.
 * Appelée périodiquement par le worker. Retourne le nombre de jobs traités.
 */
export async function runInboundQueue(): Promise<number> {
  await reclaimStaleJobs();

  let processed = 0;
  for (let i = 0; i < MAX_JOBS_PER_TICK; i++) {
    const job = await claimNextJob();
    if (!job) break;
    processed++;

    try {
      await processInboundSms({
        callerNumber: job.callerNumber,
        receiver: job.receiver ?? undefined,
        messageBody: job.body,
        providerMessageId: job.providerMessageId ?? undefined,
      });
      await db.inboundSmsJob.update({
        where: { id: job.id },
        data: { status: InboundJobStatus.done },
      });
    } catch (err) {
      const attempts = job.attempts + 1;
      const status =
        attempts >= MAX_ATTEMPTS ? InboundJobStatus.failed : InboundJobStatus.pending;
      await db.inboundSmsJob.update({
        where: { id: job.id },
        data: { status, attempts, lastError: String(err) },
      });
      logger.error({ err, jobId: job.id, attempts, status }, "Job SMS entrant en échec");
      // Échec définitif = un client final attend une réponse qui ne viendra
      // pas : prévenir l'équipe au lieu de laisser mourir en silence.
      if (status === InboundJobStatus.failed) {
        await sendAdminAlert(
          "SMS entrant en échec définitif",
          `Job ${job.id} — de ${job.callerNumber}\n\nMessage : ${job.body}\n\nErreur : ${String(err)}`
        );
      }
    }
  }

  return processed;
}

interface ClaimedJob {
  id: string;
  callerNumber: string;
  receiver: string | null;
  body: string;
  providerMessageId: string | null;
  attempts: number;
}

/**
 * Réclame le plus ancien job en attente via un compare-and-swap sur le statut :
 * seul le worker qui bascule `pending → processing` le traite, ce qui évite le
 * double-traitement même avec plusieurs instances de worker.
 */
async function claimNextJob(): Promise<ClaimedJob | null> {
  const candidate = await db.inboundSmsJob.findFirst({
    where: { status: InboundJobStatus.pending },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      callerNumber: true,
      receiver: true,
      body: true,
      providerMessageId: true,
      attempts: true,
    },
  });
  if (!candidate) return null;

  const claimed = await db.inboundSmsJob.updateMany({
    where: { id: candidate.id, status: InboundJobStatus.pending },
    data: { status: InboundJobStatus.processing },
  });
  // 0 = un autre worker a réclamé ce job entre-temps ; on repassera au tick suivant.
  if (claimed.count === 0) return null;

  return candidate;
}

/** Remet en file les jobs `processing` orphelins (worker tué en plein traitement). */
async function reclaimStaleJobs(): Promise<void> {
  const threshold = new Date(Date.now() - STALE_PROCESSING_MS);
  const { count } = await db.inboundSmsJob.updateMany({
    where: { status: InboundJobStatus.processing, updatedAt: { lt: threshold } },
    data: { status: InboundJobStatus.pending },
  });
  if (count > 0) {
    logger.warn({ count }, "Jobs SMS entrants orphelins remis en file");
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}
