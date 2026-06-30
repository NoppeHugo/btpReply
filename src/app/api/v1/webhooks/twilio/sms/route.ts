import { NextRequest } from "next/server";
import { validateTwilioSignature } from "@/lib/twilio/signature";
import {
  findOpenConversationByCallerNumber,
  getConversationForLLM,
  recordMessage,
  updateConversationState,
} from "@/lib/conversations/service";
import { qualifyMessage } from "@/lib/llm/qualification";
import { upsertLead } from "@/lib/leads/service";
import { sendSms } from "@/lib/sms/service";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { ConversationState, MessageDirection } from "@/generated/prisma/client";

export async function POST(req: NextRequest) {
  // ── Vérification signature Twilio ─────────────────────────────────────
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

  // ── Trouver le client par numéro Twilio ──────────────────────────────
  const phoneNumber = await db.phoneNumber.findUnique({
    where: { number: toNumber, active: true },
    select: { clientId: true },
  });

  if (!phoneNumber) {
    logger.warn({ toNumber }, "SMS entrant sur numéro inconnu — ignoré");
    return new Response("", { status: 200 });
  }

  const { clientId } = phoneNumber;

  // ── P2-T5 : retrouver la conversation ouverte ────────────────────────
  const conversation = await findOpenConversationByCallerNumber(clientId, callerNumber);

  if (!conversation) {
    logger.info({ clientId, callerNumber }, "SMS entrant sans conversation ouverte — ignoré");
    return new Response("", { status: 200 });
  }

  // ── Enregistrer le message entrant (P2) ──────────────────────────────
  await recordMessage({
    clientId,
    conversationId: conversation.id,
    direction: MessageDirection.inbound,
    body: messageBody,
    twilioSid,
  });

  logger.info(
    { conversationId: conversation.id, clientId, callerNumber },
    "SMS entrant enregistré — lancement qualification"
  );

  // ── P3 : pipeline de qualification LLM ───────────────────────────────
  try {
    const convData = await getConversationForLLM(conversation.id, clientId);

    if (!convData || convData.messages.length === 0) {
      logger.warn({ conversationId: conversation.id }, "Aucun message LLM disponible — skip");
      return new Response("", { status: 200 });
    }

    const result = await qualifyMessage({
      clientName: convData.clientName,
      messages: convData.messages,
    });

    // ── P3-T4/T5 : créer/MAJ Lead + mettre à jour état conv ──────────
    if (result.complete || result.needs_human) {
      await upsertLead({
        clientId,
        conversationId: conversation.id,
        callerNumber,
        type: result.qualification.type,
        urgency: result.qualification.urgency,
        location: result.qualification.location,
        availability: result.qualification.availability,
        summary: result.qualification.summary,
      });

      const nextState: ConversationState = result.needs_human
        ? ConversationState.handed_off
        : ConversationState.qualified;

      await updateConversationState(conversation.id, nextState);
    }

    // ── Envoyer la réponse SMS + enregistrer l'outbound ──────────────
    const replySid = await sendSms({
      to: callerNumber,
      from: toNumber,
      body: result.reply,
    });

    await recordMessage({
      clientId,
      conversationId: conversation.id,
      direction: MessageDirection.outbound,
      body: result.reply,
      twilioSid: replySid,
    });

    logger.info(
      {
        conversationId: conversation.id,
        complete: result.complete,
        needs_human: result.needs_human,
      },
      "Pipeline qualification terminé"
    );
  } catch (err) {
    // On absorbe l'erreur : Twilio ne doit pas retry sur un 5xx
    logger.error({ err, conversationId: conversation.id }, "Erreur pipeline qualification");
  }

  return new Response("", { status: 200 });
}
