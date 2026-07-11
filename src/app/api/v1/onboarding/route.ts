import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, HTTP } from "@/lib/api/response";
import { getAuthedUser } from "@/lib/api/auth";

// GET /api/v1/onboarding — état du wizard pour l'artisan connecté
export async function GET(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return HTTP.unauthorized();
  if (user.role === "admin") return HTTP.forbidden();

  const client = await db.client.findUnique({
    where: { id: user.clientId },
    select: {
      name: true,
      onboardingStep: true,
      onboardingCompletedAt: true,
      phoneNumbers: {
        where: { active: true },
        select: { number: true },
        take: 1,
      },
    },
  });
  if (!client) return HTTP.notFound();

  return ok({
    name: client.name,
    step: client.onboardingStep,
    completedAt: client.onboardingCompletedAt,
    phoneNumber: client.phoneNumbers[0]?.number ?? null,
  });
}

const patchSchema = z.object({
  step: z.number().int().min(0).max(20).optional(),
  completed: z.boolean().optional(),
});

// PATCH /api/v1/onboarding — sauvegarde la progression / marque terminé
export async function PATCH(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return HTTP.unauthorized();
  if (user.role === "admin") return HTTP.forbidden();

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return HTTP.badRequest(parsed.error.issues[0]?.message);

  const updated = await db.client.update({
    where: { id: user.clientId },
    data: {
      ...(parsed.data.step !== undefined
        ? { onboardingStep: parsed.data.step }
        : {}),
      ...(parsed.data.completed ? { onboardingCompletedAt: new Date() } : {}),
    },
    select: { onboardingStep: true, onboardingCompletedAt: true },
  });

  return ok({
    step: updated.onboardingStep,
    completedAt: updated.onboardingCompletedAt,
  });
}
