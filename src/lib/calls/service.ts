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

  return { callId: call.id, clientId: call.clientId };
}

/**
 * P2-T2 : planifie le premier SMS après le délai configuré, via un job
 * persisté en base drainé par le worker (survit aux redéploiements — un
 * setTimeout en mémoire perdait le SMS si le process mourait pendant le délai).
 * Idempotent : `callId` unique, un webhook rejoué ne crée pas de doublon.
 */
export async function scheduleInitialSms(
  callId: string,
  clientId: string,
  callerNumber: string
): Promise<void> {
  // Délai configurable par client (secondes) ; fallback env ou 30 s.
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { initialSmsDelaySec: true },
  });
  const delaySec =
    client?.initialSmsDelaySec ??
    Number(process.env.INITIAL_SMS_DELAY_MS ?? 30_000) / 1000;

  try {
    await db.outboundSmsJob.create({
      data: {
        clientId,
        callId,
        callerNumber,
        sendAfter: new Date(Date.now() + delaySec * 1000),
      },
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2002") {
      logger.info({ callId }, "SMS initial déjà planifié pour cet appel — ignoré");
      return;
    }
    throw err;
  }
}

/**
 * P5-T1 / P5-T3 : envoie le SMS initial maintenant (appelé par le worker
 * quand le job est échu).
 * - Skip si le numéro est en liste blanche (P5-T1)
 * - SMS d'horaires si hors ouverture (P5-T3)
 */
export async function sendInitialSmsNow(
  callId: string,
  clientId: string,
  callerNumber: string
): Promise<"sent" | "skipped_whitelist"> {
  // P5-T1 : vérifier liste blanche avant tout envoi
  if (await isNumberExcluded(clientId, callerNumber)) {
    logger.info({ clientId, callerNumber }, "Numéro en liste blanche — SMS initial ignoré");
    return "skipped_whitelist";
  }

  // P5-T3 : choisir le gabarit selon les horaires
  const open = await isWithinBusinessHours(clientId, new Date());
  const body = open
    ? await buildInitialSmsBody(clientId)
    : await buildOutOfHoursSmsBody(clientId);

  // Conversation créée d'abord : elle porte le numéro expéditeur assigné
  // depuis lequel part ce premier SMS.
  const { id: conversationId, senderNumber } = await getOrCreateConversation({
    clientId,
    callId,
    callerNumber,
  });

  const providerMessageId = await sendSms({
    to: callerNumber,
    from: senderNumber,
    body,
  });

  await recordMessage({
    clientId,
    conversationId,
    direction: MessageDirection.outbound,
    body,
    providerMessageId,
  });

  return "sent";
}
