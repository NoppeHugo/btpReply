import { NextRequest } from "next/server";
import {
  findOpenConversationByCaller,
  getConversationForLLM,
  recordMessage,
  updateConversationLanguage,
  updateConversationState,
} from "@/lib/conversations/service";
import { qualifyMessage } from "@/lib/llm/qualification";
import { upsertLead } from "@/lib/leads/service";
import { sendLeadAlert } from "@/lib/alerts/service";
import { sendSms, buildStopConfirmationBody } from "@/lib/sms/service";
import { isNumberExcluded, addToOptOutList } from "@/lib/whitelist/service";
import { detectLanguage } from "@/lib/language/detect";
import { logger } from "@/lib/logger";
import { ConversationState, MessageDirection } from "@/generated/prisma/client";

// Webhook « inbox_message » de smstools (SMS entrant).
// smstools ne signe pas ses webhooks (pas de HMAC documenté) : on sécurise par
// un token secret passé en query string dans l'URL de callback configurée côté
// smstools : https://.../api/v1/webhooks/smstools/inbound?token=SMSTOOLS_WEBHOOK_SECRET

interface InboxPayload {
  webhook_type?: string;
  message?: {
    id?: string | number;
    sender?: string; // numéro du client (appelant)
    receiver?: string; // notre numéro smstools partagé
    content?: string;
  };
}

export async function POST(req: NextRequest) {
  // ── Sécurité : token secret dans l'URL ───────────────────────────────
  const secret = process.env.SMSTOOLS_WEBHOOK_SECRET;
  const token = req.nextUrl.searchParams.get("token");
  if (!secret || token !== secret) {
    logger.warn("Webhook smstools rejeté — token invalide");
    return new Response("Forbidden", { status: 403 });
  }

  let payload: InboxPayload;
  try {
    payload = (await req.json()) as InboxPayload;
  } catch {
    logger.warn("Webhook smstools — corps JSON illisible");
    return new Response("", { status: 200 });
  }

  // On ne traite que les messages entrants.
  if (payload.webhook_type && payload.webhook_type !== "inbox_message") {
    logger.info({ type: payload.webhook_type }, "Webhook smstools ignoré (type non géré)");
    return new Response("", { status: 200 });
  }

  const callerNumber = payload.message?.sender ?? "";
  const messageBody = payload.message?.content ?? "";
  const providerMessageId =
    payload.message?.id != null ? String(payload.message.id) : undefined;

  if (!callerNumber) {
    logger.warn("SMS entrant smstools sans expéditeur — ignoré");
    return new Response("", { status: 200 });
  }

  // ── Retrouver la conversation ouverte (numéro partagé → routage par appelant)
  const conversation = await findOpenConversationByCaller(callerNumber);

  if (!conversation) {
    logger.info({ callerNumber }, "SMS entrant sans conversation ouverte — ignoré");
    return new Response("", { status: 200 });
  }

  const { clientId } = conversation;

  // ── P5-T2 : traitement STOP en priorité absolue ───────────────────────
  if (messageBody.trim().toUpperCase() === "STOP") {
    await addToOptOutList(clientId, callerNumber);
    await updateConversationState(conversation.id, ConversationState.closed, clientId);

    // Confirmer l'opt-out (expéditeur = numéro smstools partagé par défaut).
    await sendSms({ to: callerNumber, body: buildStopConfirmationBody() });

    logger.info({ clientId, callerNumber }, "STOP traité — opt-out confirmé");
    return new Response("", { status: 200 });
  }

  // ── P5-T1 : rejeter si numéro en liste blanche ───────────────────────
  if (await isNumberExcluded(clientId, callerNumber)) {
    logger.info({ clientId, callerNumber }, "SMS entrant d'un numéro exclu — ignoré");
    return new Response("", { status: 200 });
  }

  // ── Enregistrer le message entrant ───────────────────────────────────
  await recordMessage({
    clientId,
    conversationId: conversation.id,
    direction: MessageDirection.inbound,
    body: messageBody,
    providerMessageId,
  });

  // ── P5-T5 : détection de langue sur le message entrant ───────────────
  const detectedLang = detectLanguage(messageBody);
  await updateConversationLanguage(conversation.id, detectedLang, clientId);

  // ── Reprise manuelle : si l'artisan a la main, on n'active pas le bot ──
  if (!conversation.autopilot) {
    logger.info(
      { conversationId: conversation.id, clientId },
      "Conversation en mode manuel — message enregistré, qualification auto ignorée"
    );
    return new Response("", { status: 200 });
  }

  logger.info(
    { conversationId: conversation.id, clientId, callerNumber, lang: detectedLang },
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
      language: convData.language,
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

      await updateConversationState(conversation.id, nextState, clientId);

      // P4-T1 : alerte email instantanée au patron
      sendLeadAlert(clientId, {
        callerNumber,
        type: result.qualification.type,
        urgency: result.qualification.urgency,
        location: result.qualification.location,
        availability: result.qualification.availability,
        summary: result.qualification.summary,
        needs_human: result.needs_human,
      }).catch((err) =>
        logger.error({ err, conversationId: conversation.id }, "Erreur alerte lead")
      );
    }

    // ── Envoyer la réponse SMS + enregistrer l'outbound ──────────────
    const replyId = await sendSms({ to: callerNumber, body: result.reply });

    await recordMessage({
      clientId,
      conversationId: conversation.id,
      direction: MessageDirection.outbound,
      body: result.reply,
      providerMessageId: replyId,
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
    logger.error({ err, conversationId: conversation.id }, "Erreur pipeline qualification");
  }

  return new Response("", { status: 200 });
}
