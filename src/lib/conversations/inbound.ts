import {
  findOpenConversationForInbound,
  getConversationForLLM,
  messageExistsByProviderId,
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

export interface InboundSmsInput {
  callerNumber: string;
  // Notre numéro smstools destinataire (clé de routage du pool « collant »).
  receiver?: string;
  messageBody: string;
  // Identifiant du message chez smstools — clé d'idempotence.
  providerMessageId?: string;
}

/**
 * Issue du traitement d'un SMS entrant. Toutes les valeurs correspondent à un
 * webhook correctement acquitté (HTTP 200) : le webhook ne doit jamais renvoyer
 * une erreur qui pousserait smstools à retenter.
 */
export type InboundSmsOutcome =
  | "duplicate" // déjà traité (retry smstools) — ignoré
  | "no_caller" // pas d'expéditeur — ignoré
  | "no_conversation" // aucune conversation ouverte — ignoré
  | "stopped" // STOP traité — opt-out confirmé
  | "excluded" // numéro en liste blanche — ignoré
  | "manual" // conversation en mode manuel — message enregistré, pas de bot
  | "recorded" // enregistré mais qualification impossible (pas de message LLM)
  | "qualified"; // pipeline de qualification complet

/**
 * Traite un SMS entrant de bout en bout : idempotence, STOP, liste blanche,
 * enregistrement, détection de langue, puis pipeline de qualification LLM.
 *
 * Extrait du route handler webhook pour être testable et réutilisable (un futur
 * worker/queue pourra appeler cette même fonction). La fonction ne lève jamais
 * pour une erreur de qualification : elle la journalise et rend `qualified`,
 * afin que l'appelant acquitte toujours le webhook.
 */
export async function processInboundSms(
  input: InboundSmsInput
): Promise<InboundSmsOutcome> {
  const { callerNumber, receiver, messageBody, providerMessageId } = input;

  if (!callerNumber) {
    logger.warn("SMS entrant smstools sans expéditeur — ignoré");
    return "no_caller";
  }

  // ── Idempotence : ne jamais retraiter un message déjà enregistré ──────
  // La garde est placée avant tout effet de bord (LLM, envoi SMS). Le message
  // entrant étant enregistré avant l'appel LLM, un retry après enregistrement
  // court-circuite ici plutôt que de renvoyer une seconde réponse.
  if (providerMessageId && (await messageExistsByProviderId(providerMessageId))) {
    logger.info(
      { providerMessageId, callerNumber },
      "SMS entrant déjà traité (retry smstools) — ignoré"
    );
    return "duplicate";
  }

  // ── Retrouver la conversation ouverte (routage receiver + appelant) ───
  const conversation = await findOpenConversationForInbound(callerNumber, receiver);

  if (!conversation) {
    logger.info({ callerNumber, receiver }, "SMS entrant sans conversation ouverte — ignoré");
    return "no_conversation";
  }

  const { clientId } = conversation;
  // Répondre depuis le numéro du fil ; repli sur le numéro par défaut si absent.
  const from = conversation.senderNumber ?? undefined;

  // ── P5-T2 : traitement STOP en priorité absolue ───────────────────────
  if (messageBody.trim().toUpperCase() === "STOP") {
    await addToOptOutList(clientId, callerNumber);
    await updateConversationState(conversation.id, ConversationState.closed, clientId);

    // Confirmer l'opt-out depuis le numéro du fil.
    await sendSms({ to: callerNumber, from, body: buildStopConfirmationBody() });

    logger.info({ clientId, callerNumber }, "STOP traité — opt-out confirmé");
    return "stopped";
  }

  // ── P5-T1 : rejeter si numéro en liste blanche ───────────────────────
  if (await isNumberExcluded(clientId, callerNumber)) {
    logger.info({ clientId, callerNumber }, "SMS entrant d'un numéro exclu — ignoré");
    return "excluded";
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
    return "manual";
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
      return "recorded";
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
    const replyId = await sendSms({ to: callerNumber, from, body: result.reply });

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

  return "qualified";
}
