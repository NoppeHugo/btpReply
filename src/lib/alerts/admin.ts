import { sendEmail, FROM_EMAIL } from "@/lib/email/client";
import { logger } from "@/lib/logger";

// Alerte opérationnelle interne (jobs en échec définitif, anomalies worker).
// Destinataire : ALERT_ADMIN_EMAIL (optionnel — sans lui, on se contente du log,
// déjà remonté à Sentry par le worker).

export async function sendAdminAlert(
  subject: string,
  text: string
): Promise<void> {
  const to = process.env.ALERT_ADMIN_EMAIL;
  if (!to) return;

  const { error } = await sendEmail({
    from: FROM_EMAIL,
    to,
    subject: `[Rappl ops] ${subject}`,
    html: `<pre style="font-family:monospace;font-size:13px;white-space:pre-wrap">${text}</pre>`,
  });
  if (error) {
    logger.error({ error: error.message }, "Échec envoi alerte admin");
  }
}
