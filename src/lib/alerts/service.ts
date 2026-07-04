import { db } from "@/lib/db";
import { sendEmail, FROM_EMAIL } from "@/lib/email/client";
import { buildLeadAlertEmail, type LeadAlertParams } from "@/lib/email/templates";
import { sendSms } from "@/lib/sms/service";
import { logger } from "@/lib/logger";

export async function sendLeadAlert(
  clientId: string,
  params: LeadAlertParams
): Promise<void> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: {
      alertEmail: true,
      alertPhone: true,
    },
  });

  // ── Destinataires email : override alertEmail, sinon les owners ──────────
  let recipients: string[];
  if (client?.alertEmail) {
    recipients = [client.alertEmail];
  } else {
    const owners = await db.user.findMany({
      where: { clientId, role: "owner" },
      select: { email: true },
    });
    recipients = owners.map((o) => o.email);
  }

  if (recipients.length === 0) {
    logger.warn({ clientId }, "sendLeadAlert: aucun destinataire email — alerte email non envoyée");
  } else {
    const { subject, html } = buildLeadAlertEmail(params);
    const { error } = await sendEmail({
      from: FROM_EMAIL,
      to: recipients,
      subject,
      html,
    });
    if (error) {
      throw new Error(`SMTP error: ${error.message}`);
    }
    logger.info({ clientId, recipientCount: recipients.length }, "Alerte lead envoyée (email)");
  }

  // ── Alerte SMS optionnelle (si un numéro d'alerte est configuré) ─────────
  if (client?.alertPhone) {
    const urgencyLabel = params.urgency ? ` [${params.urgency}]` : "";
    const smsBody = `Nouveau lead${urgencyLabel} : ${params.type ?? "demande"} — ${params.callerNumber}. ${params.summary}`.slice(
      0,
      300
    );
    try {
      await sendSms({ to: client.alertPhone, body: smsBody });
      logger.info({ clientId }, "Alerte lead envoyée (SMS)");
    } catch (err) {
      logger.error({ err, clientId }, "Échec alerte SMS");
    }
  }
}
