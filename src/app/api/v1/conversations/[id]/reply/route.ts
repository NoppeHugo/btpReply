import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, HTTP } from "@/lib/api/response";
import { getAuthedUser } from "@/lib/api/auth";
import { sendSms } from "@/lib/sms/service";
import { recordMessage } from "@/lib/conversations/service";
import { MessageDirection } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";

const bodySchema = z.object({
  body: z.string().min(1).max(1000),
});

// POST /api/v1/conversations/[id]/reply
// Réponse manuelle de l'artisan : envoie un SMS au client, l'enregistre et
// met la conversation en mode manuel (pause du bot de qualification).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthedUser(req);
  if (!user) return HTTP.unauthorized();

  const { id } = await params;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return HTTP.badRequest(parsed.error.issues[0]?.message);

  const conversation = await db.conversation.findUnique({
    where: { id },
    select: {
      id: true,
      clientId: true,
      callerNumber: true,
      senderNumber: true,
    },
  });

  if (!conversation) return HTTP.notFound("Conversation introuvable");

  // Scoping multi-tenant : un owner ne touche que ses conversations.
  if (user.role !== "admin" && conversation.clientId !== user.clientId) {
    return HTTP.forbidden();
  }

  // 1. Envoi du SMS depuis le numéro expéditeur du fil (repli sur défaut si null)
  let providerMessageId: string;
  try {
    providerMessageId = await sendSms({
      to: conversation.callerNumber,
      from: conversation.senderNumber ?? undefined,
      body: parsed.data.body,
    });
  } catch (err) {
    logger.error({ err, conversationId: id }, "Échec envoi SMS manuel");
    return HTTP.internal();
  }

  // 2. Enregistrement du message sortant
  await recordMessage({
    clientId: conversation.clientId,
    conversationId: conversation.id,
    direction: MessageDirection.outbound,
    body: parsed.data.body,
    providerMessageId,
  });

  // 3. Pause du bot : l'artisan a repris la main
  await db.conversation.update({
    where: { id: conversation.id },
    data: { autopilot: false },
  });

  logger.info({ conversationId: id, userId: user.userId }, "Réponse manuelle envoyée — bot en pause");

  return ok({ sent: true, autopilot: false });
}
