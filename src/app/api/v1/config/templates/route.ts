import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, HTTP } from "@/lib/api/response";
import { getAuthedUser } from "@/lib/api/auth";

const putEntrySchema = z.object({
  key: z.string().min(1),
  body: z.string().min(1),
  language: z.enum(["fr", "nl"]),
});

const putSchema = z.array(putEntrySchema);

// GET /api/v1/config/templates
export async function GET(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return HTTP.unauthorized();
  if (user.role === "admin") return HTTP.forbidden();

  const templates = await db.messageTemplate.findMany({
    where: { clientId: user.clientId },
    orderBy: [{ key: "asc" }, { language: "asc" }],
    select: { id: true, key: true, body: true, language: true, updatedAt: true },
  });

  return ok(templates);
}

// PUT /api/v1/config/templates — upsert multiple templates
export async function PUT(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return HTTP.unauthorized();
  if (user.role === "admin") return HTTP.forbidden();

  const body = await req.json();
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) return HTTP.badRequest(parsed.error.issues[0]?.message);

  const ops = parsed.data.map((t) =>
    db.messageTemplate.upsert({
      where: {
        clientId_key_language: {
          clientId: user.clientId,
          key: t.key,
          language: t.language,
        },
      },
      update: { body: t.body },
      create: { clientId: user.clientId, key: t.key, body: t.body, language: t.language },
    })
  );

  const result = await db.$transaction(ops);
  return ok(result);
}
