import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, HTTP } from "@/lib/api/response";
import { createResetToken } from "@/lib/auth/reset-token";
import { sendEmail, FROM_EMAIL } from "@/lib/email/client";
import { buildPasswordResetEmail } from "@/lib/email/templates";
import { logger } from "@/lib/logger";

const schema = z.object({ email: z.string().email() });

// POST /api/v1/auth/forgot — envoie un lien de réinitialisation.
// Répond toujours 200, que l'email existe ou non (pas d'énumération de comptes).
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return HTTP.badRequest(parsed.error.issues[0]?.message);

  const user = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, email: true, passwordHash: true },
  });

  if (user) {
    const token = createResetToken(user.id, user.passwordHash);
    const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
    const resetUrl = `${base}/reset-password?token=${encodeURIComponent(token)}`;

    const { subject, html } = buildPasswordResetEmail({
      resetUrl,
      invite: !user.passwordHash,
    });
    const { error } = await sendEmail({ from: FROM_EMAIL, to: user.email, subject, html });
    if (error) {
      logger.error({ error: error.message }, "Échec envoi email de reset");
    } else {
      logger.info({ userId: user.id }, "Email de reset envoyé");
    }
  }

  return ok({ sent: true });
}
