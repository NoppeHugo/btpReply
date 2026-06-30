import twilio from "twilio";

/**
 * Vérifie la signature X-Twilio-Signature sur un webhook entrant.
 * Retourne false si la signature est absente ou invalide → rejeter la requête.
 */
export function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string
): boolean {
  const signingKey = process.env.TWILIO_WEBHOOK_SIGNING_KEY;
  if (!signingKey) return false;
  return twilio.validateRequest(signingKey, signature, url, params);
}
