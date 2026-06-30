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
 * P2-T1 / P5-T4 : construit le SMS initial après appel manqué.
 * Utilise le MessageTemplate du client (key="initial_sms") si disponible.
 * Mention STOP obligatoire (règle BE/FR).
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

/**
 * P5-T3 : SMS envoyé en dehors des heures d'ouverture.
 * Utilise le MessageTemplate (key="out_of_hours_sms") si disponible.
 */
export async function buildOutOfHoursSmsBody(
  clientId: string,
  language = "fr"
): Promise<string> {
  const [client, template] = await Promise.all([
    db.client.findUniqueOrThrow({
      where: { id: clientId },
      select: { name: true },
    }),
    db.messageTemplate.findFirst({
      where: { clientId, key: "out_of_hours_sms", language },
    }),
  ]);

  if (template) return template.body;

  if (language === "nl") {
    return `Goedag, u spreekt met ${client.name}. U heeft ons gebeld maar onze kantoren zijn momenteel gesloten. We nemen zo snel mogelijk contact met u op. Antwoord STOP om geen berichten meer te ontvangen.`;
  }

  return `Bonjour, c'est ${client.name}. Vous nous avez appelé mais nos bureaux sont actuellement fermés. Nous vous recontacterons dès que possible. Répondez STOP pour ne plus recevoir de messages.`;
}

/**
 * P5-T2 : message de confirmation envoyé après réception du mot STOP.
 * Bilingue pour couvrir les deux langues sans détection préalable.
 */
export function buildStopConfirmationBody(): string {
  return "Votre désinscription est confirmée. Vous ne recevrez plus de messages. / Uw afmelding is bevestigd. U ontvangt geen berichten meer.";
}
