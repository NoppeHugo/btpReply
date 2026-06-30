import { getTwilioClient } from "@/lib/twilio/client";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

interface SendSmsParams {
  to: string;
  from: string;
  body: string;
}

export async function sendSms(params: SendSmsParams): Promise<string> {
  const msg = await getTwilioClient().messages.create({
    to: params.to,
    from: params.from,
    body: params.body,
  });
  logger.info({ sid: msg.sid, to: params.to }, "SMS envoyé");
  return msg.sid;
}

/**
 * Construit le premier SMS après un appel manqué.
 * Utilise le MessageTemplate du client si disponible, sinon le gabarit par défaut.
 * Respecte la règle : pas de mots IA/bot/automatique. Mention STOP obligatoire.
 */
export async function buildInitialSmsBody(
  clientId: string,
  language = "fr"
): Promise<string> {
  const [client, template] = await Promise.all([
    db.client.findUniqueOrThrow({
      where: { id: clientId },
      select: { name: true },
    }),
    db.messageTemplate.findFirst({
      where: { clientId, key: "initial_sms", language },
    }),
  ]);

  if (template) return template.body;

  if (language === "nl") {
    return `Goedag, u spreekt met ${client.name}. U heeft ons gebeld maar we konden niet opnemen. Hoe kunnen we u helpen? Antwoord STOP om geen berichten meer te ontvangen.`;
  }

  return `Bonjour, c'est ${client.name}. Vous nous avez appelé mais nous n'avons pas pu décrocher. Comment pouvons-nous vous aider ? Répondez STOP pour ne plus recevoir de messages.`;
}
