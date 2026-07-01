import { db } from "@/lib/db";
import { getResendClient, FROM_EMAIL } from "@/lib/email/client";
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
      phoneNumbers: {
        where: { active: true },
        take: 1,
        select: { number: true },
      },
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
    const { error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: recipients,
      subject,
      html,
    });
    if (error) {
      throw new Error(`Resend error: ${error.message}`);
    }
    logger.info({ clientId, recipientCount: recipients.length }, "Alerte lead envoyée (email)");
  }

  // ── Alerte SMS optionnelle (si un numéro d'alerte est configuré) ─────────
  const fromNumber = client?.phoneNumbers[0]?.number;
  if (client?.alertPhone && fromNumber) {
    const urgencyLabel = params.urgency ? ` [${params.urgency}]` : "";
    const smsBody = `Nouveau lead${urgencyLabel} : ${params.type ?? "demande"} — ${params.callerNumber}. ${params.summary}`.slice(
      0,
      300
    );
    try {
      await sendSms({ to: client.alertPhone, from: fromNumber, body: smsBody });
      logger.info({ clientId }, "Alerte lead envoyée (SMS)");
    } catch (err) {
      logger.error({ err, clientId }, "Échec alerte SMS");
    }
  }
}
