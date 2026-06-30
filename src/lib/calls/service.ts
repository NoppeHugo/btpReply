import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

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

  return { callId: call.id, clientId: call.clientId };
}
