import { NextRequest } from "next/server";
import { validateTwilioSignature } from "@/lib/twilio/signature";
import {
  findOpenConversationByCallerNumber,
  getConversationForLLM,
  recordMessage,
  updateConversationLanguage,
  updateConversationState,
} from "@/lib/conversations/service";
import { qualifyMessage } from "@/lib/llm/qualification";
import { upsertLead } from "@/lib/leads/service";
import { sendLeadAlert, sendHandoffReplyAlert } from "@/lib/alerts/service";
import {
  sendSms,
  buildStopConfirmationBody,
  buildStartConfirmationBody,
} from "@/lib/sms/service";
import {
  isNumberExcluded,
  addToOptOutList,
  removeFromOptOutList,
} from "@/lib/whitelist/service";
import { isOptOutMessage, isOptInMessage } from "@/lib/sms/optout";
import { detectLanguage } from "@/lib/language/detect";
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

  // ── Idempotence : Twilio rejoue les webhooks (mêmes MessageSid) ───────
  if (twilioSid) {
    const alreadyProcessed = await db.message.findUnique({
      where: { twilioSid },
      select: { id: true },
    });
    if (alreadyProcessed) {
      logger.info({ twilioSid }, "Webhook SMS rejoué — message déjà traité");
      return new Response("", { status: 200 });
    }
  }

  // ── S3 : réinscription START (avant le check d'exclusion) ─────────────
  if (isOptInMessage(messageBody)) {
    const removed = await removeFromOptOutList(clientId, callerNumber);
    if (removed) {
      await sendSms({
        to: callerNumber,
        from: toNumber,
        body: buildStartConfirmationBody(),
      });
      logger.info({ clientId, callerNumber }, "START traité — opt-in confirmé");
    }
    return new Response("", { status: 200 });
  }

  // ── P5-T2 : traitement STOP en priorité absolue (variantes FR/NL) ─────
  if (isOptOutMessage(messageBody)) {
    await addToOptOutList(clientId, callerNumber);

    // Fermer toute conversation ouverte pour ce numéro
    const openConv = await findOpenConversationByCallerNumber(clientId, callerNumber);
    if (openConv) {
      await updateConversationState(openConv.id, ConversationState.closed, clientId);
    }

    // Confirmer l'opt-out
    await sendSms({
      to: callerNumber,
      from: toNumber,
      body: buildStopConfirmationBody(),
    });

    logger.info({ clientId, callerNumber }, "STOP traité — opt-out confirmé");
    return new Response("", { status: 200 });
  }

  // ── P5-T1 : rejeter si numéro en liste blanche ───────────────────────
  if (await isNumberExcluded(clientId, callerNumber)) {
    logger.info({ clientId, callerNumber }, "SMS entrant d'un numéro exclu — ignoré");
    return new Response("", { status: 200 });
  }

  // ── Retrouver la conversation ouverte ────────────────────────────────
  const conversation = await findOpenConversationByCallerNumber(clientId, callerNumber);

  if (!conversation) {
    logger.info({ clientId, callerNumber }, "SMS entrant sans conversation ouverte — ignoré");
    return new Response("", { status: 200 });
  }

  // ── Enregistrer le message entrant ───────────────────────────────────
  await recordMessage({
    clientId,
    conversationId: conversation.id,
    direction: MessageDirection.inbound,
    body: messageBody,
    twilioSid,
  });

  // ── P5-T5 : détection de langue sur le message entrant ───────────────
  const detectedLang = detectLanguage(messageBody);
  await updateConversationLanguage(conversation.id, detectedLang, clientId);

  // ── F2 : conversation transmise au patron → pas de bot, mais alerte ───
  if (conversation.state === ConversationState.handed_off) {
    sendHandoffReplyAlert(clientId, { callerNumber, messageBody }).catch((err) =>
      logger.error({ err, conversationId: conversation.id }, "Erreur alerte post-handoff")
    );
    logger.info(
      { conversationId: conversation.id, clientId },
      "Message reçu après handoff — enregistré, patron alerté, pas de réponse auto"
    );
    return new Response("", { status: 200 });
  }

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
    logger.error({ err, conversationId: conversation.id }, "Erreur pipeline qualification");
  }

  return new Response("", { status: 200 });
}
