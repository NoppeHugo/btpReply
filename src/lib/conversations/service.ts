import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { ConversationState, MessageDirection } from "@/generated/prisma/client";
import type { ConversationMessage } from "@/lib/llm/qualification";
import { assignSenderNumber } from "@/lib/sms/sender-pool";

interface GetOrCreateConversationParams {
  clientId: string;
  callId: string;
  callerNumber: string;
}

/**
 * Retourne la conversation du callId (créée si besoin) + son numéro expéditeur
 * assigné (pool de numéros « collants »). Le senderNumber est fixé à la création
 * et sert de clé de routage des SMS entrants.
 */
export async function getOrCreateConversation(
  params: GetOrCreateConversationParams
): Promise<{ id: string; senderNumber: string }> {
  const existing = await db.conversation.findUnique({
    where: { callId: params.callId },
    select: { id: true, senderNumber: true },
  });

  if (existing) {
    // Rattrapage : anciennes conversations sans numéro expéditeur assigné.
    const senderNumber =
      existing.senderNumber ??
      (await assignAndStoreSender(existing.id, params.callerNumber));
    return { id: existing.id, senderNumber };
  }

  const senderNumber = await assignSenderNumber(params.callerNumber);
  const conv = await db.conversation.create({
    data: {
      clientId: params.clientId,
      callId: params.callId,
      callerNumber: params.callerNumber,
      senderNumber,
    },
    select: { id: true },
  });

  logger.info(
    { conversationId: conv.id, clientId: params.clientId, senderNumber },
    "Conversation créée"
  );
  return { id: conv.id, senderNumber };
}

async function assignAndStoreSender(
  conversationId: string,
  callerNumber: string
): Promise<string> {
  const senderNumber = await assignSenderNumber(callerNumber);
  await db.conversation.update({
    where: { id: conversationId },
    data: { senderNumber },
  });
  return senderNumber;
}

interface RecordMessageParams {
  clientId: string;
  conversationId: string;
  direction: MessageDirection;
  body: string;
  providerMessageId?: string;
}

export async function recordMessage(params: RecordMessageParams): Promise<string> {
  const msg = await db.message.create({
    data: {
      clientId: params.clientId,
      conversationId: params.conversationId,
      direction: params.direction,
      body: params.body,
      providerMessageId: params.providerMessageId,
    },
    select: { id: true },
  });

  await db.conversation.update({
    where: { id: params.conversationId, clientId: params.clientId },
    // lastMessageAt : rafraîchit la fenêtre de cooldown du numéro expéditeur.
    data: { turnCount: { increment: 1 }, lastMessageAt: new Date() },
  });

  return msg.id;
}

/**
 * P2-T5 : retrouve une Conversation ouverte par numéro appelant + client.
 */
export async function findOpenConversationByCallerNumber(
  clientId: string,
  callerNumber: string
): Promise<{ id: string; callId: string; turnCount: number; autopilot: boolean } | null> {
  return db.conversation.findFirst({
    where: {
      clientId,
      callerNumber,
      state: { in: ["open", "qualified"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, callId: true, turnCount: true, autopilot: true },
  });
}

/**
 * Retrouve la conversation à laquelle rattacher un SMS entrant.
 *
 * Pool de numéros « collants » : le couple (numéro destinataire = `receiver`,
 * appelant) identifie la conversation sans ambiguïté (un appelant n'a jamais
 * deux conversations actives sur le même numéro). On route donc en priorité par
 * ce couple, avec repli sur le routage historique par appelant seul (anciennes
 * conversations sans senderNumber, ou receiver absent du webhook).
 */
export async function findOpenConversationForInbound(
  callerNumber: string,
  receiver?: string
): Promise<{
  id: string;
  clientId: string;
  callId: string;
  turnCount: number;
  autopilot: boolean;
  senderNumber: string | null;
} | null> {
  const select = {
    id: true,
    clientId: true,
    callId: true,
    turnCount: true,
    autopilot: true,
    senderNumber: true,
  };

  if (receiver) {
    const byReceiver = await db.conversation.findFirst({
      where: {
        callerNumber,
        senderNumber: receiver,
        state: { in: ["open", "qualified"] },
      },
      orderBy: { createdAt: "desc" },
      select,
    });
    if (byReceiver) return byReceiver;
  }

  // Repli : routage historique par appelant seul.
  return db.conversation.findFirst({
    where: {
      callerNumber,
      state: { in: ["open", "qualified"] },
    },
    orderBy: { createdAt: "desc" },
    select,
  });
}

interface ConversationWithMessages {
  clientName: string;
  callerNumber: string;
  fromNumber: string;
  language: string;
  messages: ConversationMessage[];
}

/**
 * P3-T3 : charge la conversation + ses messages formatés pour le LLM.
 * Skips le tout premier message outbound (SMS d'accueil) pour satisfaire
 * la contrainte de l'API Anthropic (premier rôle = "user").
 */
export async function getConversationForLLM(
  conversationId: string,
  clientId: string
): Promise<ConversationWithMessages | null> {
  const row = await db.conversation.findUnique({
    where: { id: conversationId, clientId },
    select: {
      callerNumber: true,
      language: true,
      client: { select: { name: true } },
      call: {
        select: {
          phoneNumber: { select: { number: true } },
        },
      },
      messages: {
        select: { direction: true, body: true },
        orderBy: { sentAt: "asc" },
      },
    },
  });

  if (!row) return null;

  // Drop leading outbound messages so the first LLM turn is "user"
  const rawMessages = row.messages;
  const firstInboundIdx = rawMessages.findIndex((m) => m.direction === MessageDirection.inbound);
  if (firstInboundIdx === -1) return null;

  const messages: ConversationMessage[] = rawMessages.slice(firstInboundIdx).map((m) => ({
    role: m.direction === MessageDirection.inbound ? "user" : "assistant",
    content: m.body,
  }));

  return {
    clientName: row.client.name,
    callerNumber: row.callerNumber,
    fromNumber: row.call.phoneNumber.number,
    language: row.language,
    messages,
  };
}

/**
 * P3-T3 / P3-T5 : met à jour l'état de la conversation.
 * clientId scopé pour défense en profondeur (P7-T1).
 */
export async function updateConversationState(
  conversationId: string,
  state: ConversationState,
  clientId?: string
): Promise<void> {
  await db.conversation.update({
    where: clientId
      ? { id: conversationId, clientId }
      : { id: conversationId },
    data: { state },
  });
  logger.info({ conversationId, state }, "État conversation mis à jour");
}

/**
 * P5-T5 : met à jour la langue détectée de la conversation.
 * clientId scopé pour défense en profondeur (P7-T1).
 */
export async function updateConversationLanguage(
  conversationId: string,
  language: "fr" | "nl",
  clientId?: string
): Promise<void> {
  await db.conversation.update({
    where: clientId
      ? { id: conversationId, clientId }
      : { id: conversationId },
    data: { language },
  });
}
