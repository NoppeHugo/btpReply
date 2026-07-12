import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { ok, HTTP } from "@/lib/api/response";
import { auth } from "@/auth";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

// POST /api/v1/auth/password — changer son propre mot de passe (session requise)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return HTTP.unauthorized();

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return HTTP.badRequest(parsed.error.issues[0]?.message);

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, passwordHash: true },
  });
  if (!user?.passwordHash) return HTTP.unauthorized();

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) return HTTP.badRequest("Mot de passe actuel incorrect");

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await db.user.update({ where: { id: user.id }, data: { passwordHash } });

  return ok({ changed: true });
}
