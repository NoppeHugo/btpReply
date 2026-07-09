import twilio from "twilio";
import { logger } from "@/lib/logger";

// Envoi SMS via l'API REST Twilio (messages.create). Twilio sert aussi la voix
// (fournisseur unique). Voir docs/sms-provider-decision.md.

export interface TwilioSmsSendParams {
  to: string; // numéro destinataire (format E.164, ex. +324...)
  from: string; // numéro/expéditeur Twilio (TWILIO_SENDER / pool)
  message: string; // corps du SMS (déjà assaini en 1 segment en amont)
}

/**
 * Envoie un SMS via Twilio. Retourne le `sid` du message (stocké à titre de
 * référence et comme clé d'idempotence des webhooks entrants). Lève si l'appel
 * échoue ou si les identifiants sont absents.
 */
export async function twilioSmsSend(params: TwilioSmsSendParams): Promise<string> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error("TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN manquants");
  }

  const client = twilio(accountSid, authToken);
  const msg = await client.messages.create({
    to: params.to,
    from: params.from,
    body: params.message,
  });

  if (!msg.sid) {
    logger.warn({ to: params.to }, "Twilio : sid de message absent de la réponse");
  }
  return msg.sid ?? "";
}
