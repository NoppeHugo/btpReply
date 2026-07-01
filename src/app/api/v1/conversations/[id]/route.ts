import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, HTTP } from "@/lib/api/response";
import { getAuthedUser } from "@/lib/api/auth";

const patchSchema = z.object({
  autopilot: z.boolean(),
});

// PATCH /api/v1/conversations/[id] — basculer le mode auto / manuel
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthedUser(req);
  if (!user) return HTTP.unauthorized();

  const { id } = await params;

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return HTTP.badRequest(parsed.error.issues[0]?.message);

  const conversation = await db.conversation.findUnique({
    where: { id },
    select: { clientId: true },
  });
  if (!conversation) return HTTP.notFound("Conversation introuvable");
  if (user.role !== "admin" && conversation.clientId !== user.clientId) {
    return HTTP.forbidden();
  }

  await db.conversation.update({
    where: { id },
    data: { autopilot: parsed.data.autopilot },
  });

  return ok({ autopilot: parsed.data.autopilot });
}
