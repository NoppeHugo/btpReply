import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { MessageDirection } from "@/generated/prisma/client";
import { getOrCreateConversation, recordMessage } from "@/lib/conversations/service";
import { buildInitialSmsBody, sendSms } from "@/lib/sms/service";

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

/**
 * Trouve le client par numéro Twilio, crée l'enregistrement Call.
 * Retourne null si le numéro est inconnu (appel non routé).
 */
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
 * P2-T2 : envoie le premier SMS après le délai configuré (défaut 30s).
 * Appelé en fire-and-forget depuis le webhook Voice, après la réponse TwiML.
 */
export function scheduleInitialSms(
  callId: string,
  clientId: string,
  callerNumber: string,
  fromNumber: string
): void {
  const delayMs = Number(process.env.INITIAL_SMS_DELAY_MS ?? 30_000);

  setTimeout(async () => {
    try {
      const body = await buildInitialSmsBody(clientId);
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
