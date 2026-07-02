import { getTwilioClient } from "@/lib/twilio/client";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { enforceSingleSegment, computeSegments, sanitizeToGsm7 } from "./segments";

interface SendSmsParams {
  to: string;
  from: string;
  body: string;
  /**
   * F3 (audit) : true pour les messages écrits par un humain (réponse manuelle
   * de l'artisan) — on assainit en GSM-7 mais on ne tronque JAMAIS son texte.
   * Le garde-fou 1 segment ne s'applique qu'aux messages générés (bot, gabarits).
   */
  allowMultiSegment?: boolean;
}

export async function sendSms(params: SendSmsParams): Promise<string> {
  let body: string;

  if (params.allowMultiSegment) {
    body = sanitizeToGsm7(params.body).trim();
    const info = computeSegments(body);
    if (info.segments > 1) {
      logger.info(
        { to: params.to, segments: info.segments },
        "SMS manuel multi-segments envoyé"
      );
    }
  } else {
    // Garde-fou coût : assainir en GSM-7 et garantir 1 seul segment facturé.
    const result = enforceSingleSegment(params.body);
    body = result.body;
    if (result.truncated) {
      logger.warn(
        { to: params.to, original: computeSegments(params.body) },
        "SMS sortant tronqué pour tenir en 1 segment"
      );
    }
  }

  const msg = await getTwilioClient().messages.create({
    to: params.to,
    from: params.from,
    body,
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

/**
 * S3 (audit) : confirmation envoyée après un START (réinscription).
 * Bilingue, comme la confirmation STOP.
 */
export function buildStartConfirmationBody(): string {
  return "C'est noté, vous pouvez de nouveau recevoir nos messages. / Genoteerd, u kunt opnieuw berichten van ons ontvangen.";
}
