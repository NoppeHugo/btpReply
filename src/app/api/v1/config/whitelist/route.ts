import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, HTTP } from "@/lib/api/response";
import { getAuthedUser } from "@/lib/api/auth";

const postSchema = z.object({
  number: z.string().min(6),
  label: z.string().optional(),
  source: z.enum(["manual", "passive"]).optional(),
});

// GET /api/v1/config/whitelist
export async function GET(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return HTTP.unauthorized();
  if (user.role === "admin") return HTTP.forbidden();

  const entries = await db.whitelistEntry.findMany({
    where: { clientId: user.clientId },
    orderBy: { createdAt: "desc" },
    select: { id: true, number: true, label: true, createdAt: true },
  });

  return ok(entries);
}

// POST /api/v1/config/whitelist
export async function POST(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return HTTP.unauthorized();
  if (user.role === "admin") return HTTP.forbidden();

  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return HTTP.badRequest(parsed.error.issues[0]?.message);

  const source = parsed.data.source ?? "manual";
  const entry = await db.whitelistEntry.upsert({
    where: {
      clientId_number: { clientId: user.clientId, number: parsed.data.number },
    },
    update: { label: parsed.data.label },
    create: {
      clientId: user.clientId,
      number: parsed.data.number,
      label: parsed.data.label,
      source,
    },
    select: { id: true, number: true, label: true, createdAt: true },
  });

  return ok(entry, 201);
}
