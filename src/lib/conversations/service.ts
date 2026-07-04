import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { ConversationState, MessageDirection } from "@/generated/prisma/client";
import type { ConversationMessage } from "@/lib/llm/qualification";

interface GetOrCreateConversationParams {
  clientId: string;
  callId: string;
  callerNumber: string;
}

export async function getOrCreateConversation(
  params: GetOrCreateConversationParams
): Promise<string> {
  const existing = await db.conversation.findUnique({
    where: { callId: params.callId },
    select: { id: true },
  });

  if (existing) return existing.id;

  const conv = await db.conversation.create({
    data: {
      clientId: params.clientId,
      callId: params.callId,
      callerNumber: params.callerNumber,
    },
    select: { id: true },
  });

  logger.info({ conversationId: conv.id, clientId: params.clientId }, "Conversation créée");
  return conv.id;
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
    data: { turnCount: { increment: 1 }, updatedAt: new Date() },
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
 * Numéro smstools partagé entre tous les clients : on ne peut pas déduire le
 * client depuis le numéro destinataire. On retrouve donc la conversation
 * ouverte la plus récente pour ce numéro appelant, tous clients confondus,
 * et on en déduit le clientId.
 */
export async function findOpenConversationByCaller(
  callerNumber: string
): Promise<{
  id: string;
  clientId: string;
  callId: string;
  turnCount: number;
  autopilot: boolean;
} | null> {
  return db.conversation.findFirst({
    where: {
      callerNumber,
      state: { in: ["open", "qualified"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, clientId: true, callId: true, turnCount: true, autopilot: true },
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
