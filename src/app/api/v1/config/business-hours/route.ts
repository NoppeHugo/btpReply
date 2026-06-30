import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, HTTP } from "@/lib/api/response";
import { getAuthedUser } from "@/lib/api/auth";

const hoursEntrySchema = z.object({
  dayOfWeek: z.enum([
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ]),
  openTime: z.string().regex(/^\d{2}:\d{2}$/),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/),
  closed: z.boolean().default(false),
});

const putSchema = z.array(hoursEntrySchema);

// GET /api/v1/config/business-hours
export async function GET(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return HTTP.unauthorized();
  if (user.role === "admin") return HTTP.forbidden();

  const hours = await db.businessHours.findMany({
    where: { clientId: user.clientId },
    orderBy: { dayOfWeek: "asc" },
  });

  return ok(hours);
}

// PUT /api/v1/config/business-hours — upsert all 7 days
export async function PUT(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return HTTP.unauthorized();
  if (user.role === "admin") return HTTP.forbidden();

  const body = await req.json();
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) return HTTP.badRequest(parsed.error.issues[0]?.message);

  const ops = parsed.data.map((entry) =>
    db.businessHours.upsert({
      where: {
        clientId_dayOfWeek: {
          clientId: user.clientId,
          dayOfWeek: entry.dayOfWeek,
        },
      },
      update: { openTime: entry.openTime, closeTime: entry.closeTime, closed: entry.closed },
      create: { clientId: user.clientId, ...entry },
    })
  );

  const result = await db.$transaction(ops);
  return ok(result);
}
