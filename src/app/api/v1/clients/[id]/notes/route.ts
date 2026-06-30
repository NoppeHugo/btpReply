import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, HTTP } from "@/lib/api/response";
import { getAuthedUser } from "@/lib/api/auth";

const schema = z.object({ body: z.string().min(1).max(2000) });

// POST /api/v1/clients/[id]/notes — note interne admin (P6-T8)
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

  const exists = await db.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!exists) return HTTP.notFound("Client introuvable");

  // authorId = userId from session (api-token fallback use seed admin)
  const authorId =
    user.userId === "api-token"
      ? (await db.user.findFirst({ where: { role: "admin" }, select: { id: true } }))?.id
      : user.userId;

  if (!authorId) return HTTP.internal();

  const note = await db.clientNote.create({
    data: { clientId, authorId, body: parsed.data.body },
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: { email: true } },
    },
  });

  return ok(
    { ...note, authorEmail: note.author.email },
    201
  );
}
