import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, HTTP } from "@/lib/api/response";
import { getAuthedUser } from "@/lib/api/auth";

const patchSchema = z.object({
  status: z.enum(["new", "to_callback", "done"]),
});

// PATCH /api/v1/leads/[id] — mise à jour du statut (P6-T2)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthedUser(req);
  if (!user) return HTTP.unauthorized();

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return HTTP.badRequest(parsed.error.issues[0]?.message);

  const existing = await db.lead.findUnique({
    where: { id },
    select: { clientId: true },
  });

  if (!existing) return HTTP.notFound("Lead introuvable");

  if (user.role !== "admin" && existing.clientId !== user.clientId) {
    return HTTP.forbidden();
  }

  const lead = await db.lead.update({
    where: { id },
    data: { status: parsed.data.status },
    select: { id: true, status: true, updatedAt: true },
  });

  return ok(lead);
}
