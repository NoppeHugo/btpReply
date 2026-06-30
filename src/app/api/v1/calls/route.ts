import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, HTTP } from "@/lib/api/response";
import { getAuthedUser } from "@/lib/api/auth";

// GET /api/v1/calls?limit=50&offset=0
export async function GET(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return HTTP.unauthorized();

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const where = user.role === "admin" ? {} : { clientId: user.clientId };

  const [calls, total] = await Promise.all([
    db.call.findMany({
      where,
      orderBy: { calledAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        clientId: true,
        callerNumber: true,
        calledAt: true,
        client: { select: { name: true, displayName: true } },
        conversation: {
          select: {
            id: true,
            state: true,
            lead: { select: { type: true, urgency: true, status: true } },
          },
        },
      },
    }),
    db.call.count({ where }),
  ]);

  return ok({ calls, total, limit, offset });
}
