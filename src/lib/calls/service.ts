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

/**
 * P2-T2 / P5-T1 / P5-T3 : envoie le premier SMS après le délai configuré.
 * - Skip si le numéro est en liste blanche (P5-T1)
 * - SMS d'horaires si hors ouverture (P5-T3)
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
  const delayMs = delaySec * 1000;

  setTimeout(async () => {
    try {
      // P5-T1 : vérifier liste blanche avant tout envoi
      if (await isNumberExcluded(clientId, callerNumber)) {
        logger.info({ clientId, callerNumber }, "Numéro en liste blanche — SMS initial ignoré");
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
    } catch (err) {
      logger.error({ err, callId }, "Erreur lors de l'envoi du SMS initial");
    }
  }, delayMs);
}
