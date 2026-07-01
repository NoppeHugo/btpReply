import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, HTTP } from "@/lib/api/response";
import { getAuthedUser } from "@/lib/api/auth";

const putSchema = z.object({
  initialSmsDelaySec: z.number().int().min(0).max(600),
  alertEmail: z.string().email().nullable().or(z.literal("")),
  alertPhone: z
    .string()
    .regex(/^\+\d{8,15}$/, "Format E.164 requis (+32...)")
    .nullable()
    .or(z.literal("")),
});

// GET /api/v1/config/settings
export async function GET(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return HTTP.unauthorized();
  if (user.role === "admin") return HTTP.forbidden();

  const client = await db.client.findUnique({
    where: { id: user.clientId },
    select: { initialSmsDelaySec: true, alertEmail: true, alertPhone: true },
  });
  if (!client) return HTTP.notFound();

  return ok(client);
}

// PUT /api/v1/config/settings
export async function PUT(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return HTTP.unauthorized();
  if (user.role === "admin") return HTTP.forbidden();

  const parsed = putSchema.safeParse(await req.json());
  if (!parsed.success) return HTTP.badRequest(parsed.error.issues[0]?.message);

  const updated = await db.client.update({
    where: { id: user.clientId },
    data: {
      initialSmsDelaySec: parsed.data.initialSmsDelaySec,
      alertEmail: parsed.data.alertEmail || null,
      alertPhone: parsed.data.alertPhone || null,
    },
    select: { initialSmsDelaySec: true, alertEmail: true, alertPhone: true },
  });

  return ok(updated);
}
