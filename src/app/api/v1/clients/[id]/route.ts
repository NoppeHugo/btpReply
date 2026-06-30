import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, HTTP } from "@/lib/api/response";
import { getAuthedUser } from "@/lib/api/auth";
import { monthBoundsInTz } from "@/lib/time";

function canAccessClient(role: string, ownClientId: string, targetId: string): boolean {
  if (role === "admin") return true;
  return ownClientId === targetId;
}

// GET /api/v1/clients/[id] — détail + stats + journal (P6-T6)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthedUser(req);
  if (!user) return HTTP.unauthorized();

  const { id } = await params;
  if (!canAccessClient(user.role, user.clientId, id)) return HTTP.forbidden();

  const client = await db.client.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      displayName: true,
      stage: true,
      timezone: true,
      createdAt: true,
      users: {
        where: { role: "owner" },
        select: { id: true, email: true, role: true },
      },
    },
  });

  if (!client) return HTTP.notFound("Client introuvable");

  const now = new Date();
  const { start: monthStart, end: monthEnd } = monthBoundsInTz(client.timezone, now);

  const [callsMonth, leadsMonth, leadsToCallback, recentConversations] =
    await Promise.all([
      db.call.count({ where: { clientId: id, calledAt: { gte: monthStart, lte: monthEnd } } }),
      db.lead.count({ where: { clientId: id, createdAt: { gte: monthStart, lte: monthEnd } } }),
      db.lead.count({ where: { clientId: id, status: "to_callback" } }),
      db.conversation.findMany({
        where: { clientId: id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          callerNumber: true,
          state: true,
          turnCount: true,
          language: true,
          createdAt: true,
          lead: {
            select: { type: true, urgency: true, status: true, summary: true },
          },
        },
      }),
    ]);

  return ok({
    ...client,
    stats: {
      callsThisMonth: callsMonth,
      leadsThisMonth: leadsMonth,
      leadsToCallback,
    },
    recentConversations,
  });
}

// PATCH /api/v1/clients/[id] — renommage displayName (P6-T7)
const patchSchema = z.object({
  displayName: z.string().min(1).max(100),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthedUser(req);
  if (!user) return HTTP.unauthorized();
  if (user.role !== "admin") return HTTP.forbidden();

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return HTTP.badRequest(parsed.error.issues[0]?.message);

  const client = await db.client.update({
    where: { id },
    data: { displayName: parsed.data.displayName },
    select: { id: true, name: true, displayName: true },
  });

  return ok(client);
}
