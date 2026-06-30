import { NextRequest } from "next/server";
import { validateTwilioSignature } from "@/lib/twilio/signature";
import { findOpenConversationByCallerNumber, recordMessage } from "@/lib/conversations/service";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { MessageDirection } from "@/generated/prisma/client";

export async function POST(req: NextRequest) {
  // --- Vérification signature (règle dure §4-3) ---
  const signature = req.headers.get("x-twilio-signature") ?? "";
  const url = `${process.env.APP_BASE_URL}/api/v1/webhooks/twilio/sms`;
  const body = await req.formData();
  const params = Object.fromEntries(
    [...body.entries()].map(([k, v]) => [k, String(v)])
  );

  if (!validateTwilioSignature(url, params, signature)) {
    logger.warn("Webhook SMS rejeté — signature invalide");
    return new Response("Forbidden", { status: 403 });
  }

  const callerNumber = params["From"] ?? "";
  const toNumber = params["To"] ?? "";
  const messageBody = params["Body"] ?? "";
  const twilioSid = params["MessageSid"] ?? undefined;

  // --- Trouver le client par numéro Twilio ---
  const phoneNumber = await db.phoneNumber.findUnique({
    where: { number: toNumber, active: true },
    select: { clientId: true },
  });

  if (!phoneNumber) {
    logger.warn({ toNumber }, "SMS entrant sur numéro inconnu — ignoré");
    return new Response("", { status: 200 });
  }

  const { clientId } = phoneNumber;

  // --- P2-T4/T5 : retrouver ou ignorer si aucune conversation ouverte ---
  const conversation = await findOpenConversationByCallerNumber(clientId, callerNumber);

  if (!conversation) {
    logger.info({ clientId, callerNumber }, "SMS entrant sans conversation ouverte — ignoré");
    return new Response("", { status: 200 });
  }

  // --- Enregistrer le message entrant ---
  await recordMessage({
    clientId,
    conversationId: conversation.id,
    direction: MessageDirection.inbound,
    body: messageBody,
    twilioSid,
  });

  logger.info(
    { conversationId: conversation.id, clientId, callerNumber },
    "SMS entrant enregistré"
  );

  // Réponse vide — la logique de qualification (P3) prend le relais
  return new Response("", { status: 200 });
}
