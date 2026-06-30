import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, HTTP } from "@/lib/api/response";
import { getAuthedUser } from "@/lib/api/auth";
import type { LeadStatus } from "@/generated/prisma/enums";

// GET /api/v1/leads?status=new&limit=50&offset=0
export async function GET(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return HTTP.unauthorized();

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0");
  const statusRaw = searchParams.get("status");
  const status = statusRaw as LeadStatus | undefined;

  const where = {
    ...(user.role === "admin" ? {} : { clientId: user.clientId }),
    ...(status ? { status } : {}),
  };

  const [leads, total] = await Promise.all([
    db.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        clientId: true,
        type: true,
        urgency: true,
        location: true,
        availability: true,
        summary: true,
        status: true,
        createdAt: true,
        client: { select: { name: true, displayName: true } },
        conversation: { select: { callerNumber: true } },
      },
    }),
    db.lead.count({ where }),
  ]);

  const leadsWithNumber = leads.map((l) => ({
    ...l,
    callerNumber: l.conversation.callerNumber,
    conversation: undefined,
  }));

  return ok({ leads: leadsWithNumber, total, limit, offset });
}
