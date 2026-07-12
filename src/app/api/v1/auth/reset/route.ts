import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { ok, HTTP, err } from "@/lib/api/response";
import { peekResetToken, verifyResetToken } from "@/lib/auth/reset-token";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

// POST /api/v1/auth/reset — définit un nouveau mot de passe via token
// (reset « oublié » ou lien d'invitation d'un compte sans mot de passe).
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return HTTP.badRequest(parsed.error.issues[0]?.message);

  if (!rateLimit(`reset:ip:${clientIp(req.headers)}`, 10, 60 * 60 * 1000)) {
    return err("Trop de demandes — réessayez plus tard", 429, "RATE_LIMITED");
  }

  const userId = peekResetToken(parsed.data.token);
  if (!userId) return HTTP.badRequest("Lien invalide ou expiré");

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true },
  });
  if (!user) return HTTP.badRequest("Lien invalide ou expiré");

  // La signature est liée au hash actuel : un token déjà consommé (mot de
  // passe changé entre-temps) ne vérifie plus.
  const verified = verifyResetToken(parsed.data.token, user.passwordHash);
  if (verified !== user.id) return HTTP.badRequest("Lien invalide ou expiré");

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await db.user.update({ where: { id: user.id }, data: { passwordHash } });

  logger.info({ userId: user.id }, "Mot de passe (ré)initialisé via token");
  return ok({ reset: true });
}
