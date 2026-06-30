import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, HTTP } from "@/lib/api/response";
import { getAuthedUser } from "@/lib/api/auth";

// GET /api/v1/clients — admin: tous ; owner: son seul client
export async function GET(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return HTTP.unauthorized();

  if (user.role === "admin") {
    const clients = await db.client.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        displayName: true,
        stage: true,
        timezone: true,
        createdAt: true,
        _count: { select: { calls: true, leads: true } },
      },
    });
    return ok(clients);
  }

  const client = await db.client.findUnique({
    where: { id: user.clientId },
    select: {
      id: true,
      name: true,
      displayName: true,
      stage: true,
      timezone: true,
      createdAt: true,
      _count: { select: { calls: true, leads: true } },
    },
  });

  if (!client) return HTTP.notFound("Client introuvable");
  return ok([client]);
}
