import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, HTTP } from "@/lib/api/response";
import { getAuthedUser } from "@/lib/api/auth";

// DELETE /api/v1/config/whitelist/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthedUser(req);
  if (!user) return HTTP.unauthorized();
  if (user.role === "admin") return HTTP.forbidden();

  const { id } = await params;

  const existing = await db.whitelistEntry.findUnique({
    where: { id },
    select: { clientId: true, label: true },
  });

  if (!existing) return HTTP.notFound("Entrée introuvable");
  if (existing.clientId !== user.clientId) return HTTP.forbidden();
  // opted_out entries are STOP-compliance records — cannot be deleted via this route
  if (existing.label === "opted_out") return HTTP.badRequest("STOP opt-out cannot be removed");

  await db.whitelistEntry.delete({ where: { id } });
  return ok({ deleted: true });
}
