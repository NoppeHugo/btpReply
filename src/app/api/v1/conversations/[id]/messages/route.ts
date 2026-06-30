import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, HTTP } from "@/lib/api/response";
import { getAuthedUser } from "@/lib/api/auth";

// GET /api/v1/conversations/[id]/messages
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthedUser(req);
  if (!user) return HTTP.unauthorized();

  const { id } = await params;

  const conversation = await db.conversation.findUnique({
    where: { id },
    select: {
      id: true,
      clientId: true,
      callerNumber: true,
      state: true,
      turnCount: true,
      language: true,
      createdAt: true,
      lead: {
        select: {
          type: true,
          urgency: true,
          location: true,
          availability: true,
          summary: true,
          status: true,
        },
      },
      messages: {
        orderBy: { sentAt: "asc" },
        select: {
          id: true,
          direction: true,
          body: true,
          sentAt: true,
        },
      },
    },
  });

  if (!conversation) return HTTP.notFound("Conversation introuvable");

  if (user.role !== "admin" && conversation.clientId !== user.clientId) {
    return HTTP.forbidden();
  }

  return ok(conversation);
}
