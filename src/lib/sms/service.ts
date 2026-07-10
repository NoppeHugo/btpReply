import { twilioSmsSend } from "@/lib/twilio/sms";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { enforceSingleSegment, computeSegments } from "./segments";

interface SendSmsParams {
  to: string;
  // Expéditeur = numéro Twilio du client (celui qui a reçu l'appel). Requis :
  // chaque client émet depuis son propre numéro, il n'y a pas d'expéditeur global.
  from?: string;
  body: string;
}

export async function sendSms(params: SendSmsParams): Promise<string> {
  // Garde-fou coût : assainir en GSM-7 et garantir 1 seul segment facturé.
  const { body, truncated } = enforceSingleSegment(params.body);
  if (truncated) {
    logger.warn(
      { to: params.to, original: computeSegments(params.body) },
      "SMS sortant tronqué pour tenir en 1 segment"
    );
  }

  if (!params.from) {
    throw new Error("Numéro expéditeur (from) manquant pour l'envoi SMS");
  }

  const id = await twilioSmsSend({ to: params.to, from: params.from, message: body });
  logger.info({ id, to: params.to }, "SMS envoyé");
  return id;
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

  // Gabarits courts : tiennent en 1 segment SMS, nom d'entreprise inclus.
  if (language === "nl") {
    return `Goedag, met ${client.name}. We hebben uw oproep gemist. Hoe kunnen we u helpen? Antwoord STOP om af te melden.`;
  }

  return `Bonjour, c'est ${client.name}. On a manqué votre appel. Comment pouvons-nous vous aider ? Répondez STOP pour vous désinscrire.`;
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

  // Gabarits courts : tiennent en 1 segment SMS, nom d'entreprise inclus.
  if (language === "nl") {
    return `Goedag, met ${client.name}. We hebben uw oproep gemist, ons kantoor is gesloten. We nemen snel contact op. STOP om af te melden.`;
  }

  return `Bonjour, c'est ${client.name}. On a manqué votre appel, nos bureaux sont fermés. On vous recontacte vite. STOP pour vous désinscrire.`;
}

/**
 * P5-T2 : message de confirmation envoyé après réception du mot STOP.
 * Bilingue pour couvrir les deux langues sans détection préalable.
 */
export function buildStopConfirmationBody(): string {
  return "Votre désinscription est confirmée. Vous ne recevrez plus de messages. / Uw afmelding is bevestigd. U ontvangt geen berichten meer.";
}
