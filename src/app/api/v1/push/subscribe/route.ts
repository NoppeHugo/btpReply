import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, HTTP } from "@/lib/api/response";
import { getAuthedUser } from "@/lib/api/auth";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

// POST /api/v1/push/subscribe — enregistre l'abonnement push de cet appareil
export async function POST(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return HTTP.unauthorized();
  if (user.role === "admin") return HTTP.forbidden();

  const parsed = subscribeSchema.safeParse(await req.json());
  if (!parsed.success) return HTTP.badRequest(parsed.error.issues[0]?.message);

  const { endpoint, keys } = parsed.data;

  await db.pushSubscription.upsert({
    where: { endpoint },
    update: { clientId: user.clientId, userId: user.userId, ...keys },
    create: {
      clientId: user.clientId,
      userId: user.userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
  });

  return ok({ subscribed: true }, 201);
}

const unsubscribeSchema = z.object({ endpoint: z.string().url() });

// DELETE /api/v1/push/subscribe — désabonne cet appareil
export async function DELETE(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return HTTP.unauthorized();

  const parsed = unsubscribeSchema.safeParse(await req.json());
  if (!parsed.success) return HTTP.badRequest(parsed.error.issues[0]?.message);

  await db.pushSubscription
    .deleteMany({
      where: {
        endpoint: parsed.data.endpoint,
        ...(user.role === "admin" ? {} : { clientId: user.clientId }),
      },
    })
    .catch(() => {});

  return ok({ unsubscribed: true });
}
