import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { MessageDirection } from "@/generated/prisma/client";

interface GetOrCreateConversationParams {
  clientId: string;
  callId: string;
  callerNumber: string;
}

/**
 * Retrouve ou crée la Conversation liée à un appel.
 * P2-T4 : une Conversation par appel (1-to-1 via callId).
 */
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
  twilioSid?: string;
}

export async function recordMessage(params: RecordMessageParams): Promise<string> {
  const msg = await db.message.create({
    data: {
      clientId: params.clientId,
      conversationId: params.conversationId,
      direction: params.direction,
      body: params.body,
      twilioSid: params.twilioSid,
    },
    select: { id: true },
  });

  // Incrémenter le compteur de tours
  await db.conversation.update({
    where: { id: params.conversationId },
    data: { turnCount: { increment: 1 }, updatedAt: new Date() },
  });

  return msg.id;
}

/**
 * P2-T5 : retrouve une Conversation ouverte par numéro appelant + client.
 * Utilisé quand un SMS entrant arrive sans CallId connu.
 */
export async function findOpenConversationByCallerNumber(
  clientId: string,
  callerNumber: string
): Promise<{ id: string; callId: string; turnCount: number } | null> {
  return db.conversation.findFirst({
    where: {
      clientId,
      callerNumber,
      state: { in: ["open", "qualified"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, callId: true, turnCount: true },
  });
}
