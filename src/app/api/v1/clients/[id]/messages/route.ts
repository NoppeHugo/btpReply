import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, HTTP } from "@/lib/api/response";
import { getAuthedUser } from "@/lib/api/auth";
import { getResendClient, FROM_EMAIL } from "@/lib/email/client";
import { logger } from "@/lib/logger";

const schema = z.object({
  channel: z.enum(["email", "in_app"]),
  body: z.string().min(1).max(2000),
  subject: z.string().max(200).optional(),
});

// POST /api/v1/clients/[id]/messages — message fondateurs → artisan (P6-T9)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthedUser(req);
  if (!user) return HTTP.unauthorized();
  if (user.role !== "admin") return HTTP.forbidden();

  const { id: clientId } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return HTTP.badRequest(parsed.error.issues[0]?.message);

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      users: { where: { role: "owner" }, select: { email: true } },
    },
  });

  if (!client) return HTTP.notFound("Client introuvable");

  const authorId =
    user.userId === "api-token"
      ? (await db.user.findFirst({ where: { role: "admin" }, select: { id: true } }))?.id
      : user.userId;

  if (!authorId) return HTTP.internal();

  // Envoi email si canal email
  if (parsed.data.channel === "email") {
    if (client.users.length === 0) {
      return HTTP.badRequest("Ce client n'a pas d'utilisateur owner pour recevoir l'email");
    }
    const { error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: client.users.map((u) => u.email),
      subject: parsed.data.subject ?? `Message de btpReply — ${client.name}`,
      html: `<div style="font-family:sans-serif">${parsed.data.body.replace(/\n/g, "<br>")}</div>`,
    });
    if (error) {
      logger.error({ error }, "Erreur envoi message client");
      return HTTP.internal();
    }
  }

  const msg = await db.clientMessage.create({
    data: {
      clientId,
      authorId,
      channel: parsed.data.channel,
      body: parsed.data.body,
      status: "sent",
    },
    select: { id: true, channel: true, body: true, sentAt: true },
  });

  return ok(msg, 201);
}
