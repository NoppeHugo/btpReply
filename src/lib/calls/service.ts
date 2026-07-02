import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { MessageDirection } from "@/generated/prisma/client";
import { getOrCreateConversation, recordMessage } from "@/lib/conversations/service";
import {
  buildInitialSmsBody,
  buildOutOfHoursSmsBody,
  sendSms,
} from "@/lib/sms/service";
import { isNumberExcluded } from "@/lib/whitelist/service";
import { isWithinBusinessHours } from "@/lib/business-hours/service";

interface IncomingCallParams {
  twilioCallSid: string;
  callerNumber: string;
  toNumber: string;
  calledAt: Date;
}

interface CreateCallResult {
  callId: string;
  clientId: string;
  fromNumber: string;
}

export async function handleIncomingCall(
  params: IncomingCallParams
): Promise<CreateCallResult | null> {
  const { twilioCallSid, callerNumber, toNumber, calledAt } = params;

  const phoneNumber = await db.phoneNumber.findUnique({
    where: { number: toNumber, active: true },
    select: { id: true, clientId: true },
  });

  if (!phoneNumber) {
    logger.warn({ toNumber }, "Appel reçu sur numéro inconnu — ignoré");
    return null;
  }

  // Idempotence : Twilio rejoue les webhooks — un CallSid déjà traité ne doit
  // ni créer un doublon ni replanifier un SMS.
  const existing = await db.call.findUnique({
    where: { twilioCallSid },
    select: { id: true },
  });
  if (existing) {
    logger.info({ twilioCallSid, callId: existing.id }, "Webhook voice rejoué — appel déjà traité");
    return null;
  }

  const call = await db.call.create({
    data: {
      clientId: phoneNumber.clientId,
      phoneNumberId: phoneNumber.id,
      callerNumber,
      calledAt,
      twilioCallSid,
    },
    select: { id: true, clientId: true },
  });

  logger.info(
    { callId: call.id, clientId: call.clientId, callerNumber },
    "Appel manqué journalisé"
  );

  return { callId: call.id, clientId: call.clientId, fromNumber: toNumber };
}

export const JOB_INITIAL_SMS = "initial_sms";

export interface InitialSmsJobPayload {
  callId: string;
  clientId: string;
  callerNumber: string;
  fromNumber: string;
}

/**
 * P2-T2 : planifie le premier SMS après le délai configuré.
 * Le job est persisté en base (ScheduledJob) et traité par le worker :
 * un redéploiement ou un crash de l'app ne perd plus aucun SMS.
 */
export async function scheduleInitialSms(
  callId: string,
  clientId: string,
  callerNumber: string,
  fromNumber: string
): Promise<void> {
  // Délai configurable par client (secondes) ; fallback env ou 30 s.
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { initialSmsDelaySec: true },
  });
  const delaySec =
    client?.initialSmsDelaySec ??
    Number(process.env.INITIAL_SMS_DELAY_MS ?? 30_000) / 1000;

  const payload: InitialSmsJobPayload = { callId, clientId, callerNumber, fromNumber };

  await db.scheduledJob.create({
    data: {
      type: JOB_INITIAL_SMS,
      payload: { ...payload },
      runAt: new Date(Date.now() + delaySec * 1000),
    },
  });

  logger.info({ callId, clientId, delaySec }, "SMS initial planifié (job persistant)");
}

/**
 * P5-T1 / P5-T3 : envoie effectivement le SMS initial (exécuté par le worker).
 * - Skip si le numéro est en liste blanche (P5-T1)
 * - SMS d'horaires si hors ouverture (P5-T3)
 */
export async function processInitialSms(payload: InitialSmsJobPayload): Promise<void> {
  const { callId, clientId, callerNumber, fromNumber } = payload;

  // P5-T1 : vérifier liste blanche avant tout envoi
  if (await isNumberExcluded(clientId, callerNumber)) {
    logger.info({ clientId, callerNumber }, "Numéro en liste blanche — SMS initial ignoré");
    return;
  }

  // Idempotence : si la conversation liée à cet appel a déjà un message
  // sortant, le SMS initial est déjà parti (retry après échec partiel).
  const existingConv = await db.conversation.findUnique({
    where: { callId },
    select: { id: true, messages: { where: { direction: MessageDirection.outbound }, take: 1, select: { id: true } } },
  });
  if (existingConv && existingConv.messages.length > 0) {
    logger.info({ callId }, "SMS initial déjà envoyé — job ignoré");
    return;
  }

  // P5-T3 : choisir le gabarit selon les horaires
  const open = await isWithinBusinessHours(clientId, new Date());
  const body = open
    ? await buildInitialSmsBody(clientId)
    : await buildOutOfHoursSmsBody(clientId);

  const twilioSid = await sendSms({ to: callerNumber, from: fromNumber, body });

  const conversationId = await getOrCreateConversation({
    clientId,
    callId,
    callerNumber,
  });

  await recordMessage({
    clientId,
    conversationId,
    direction: MessageDirection.outbound,
    body,
    twilioSid,
  });
}
