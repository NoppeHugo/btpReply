import { db } from "@/lib/db";
import { sendEmail, FROM_EMAIL } from "@/lib/email/client";
import {
  buildLeadAlertEmail,
  buildHandoffReplyAlertEmail,
  type LeadAlertParams,
} from "@/lib/email/templates";
import { sendSms } from "@/lib/sms/service";
import { logger } from "@/lib/logger";

/** Destinataires d'alerte : override alertEmail, sinon les owners du client. */
async function resolveAlertRecipients(clientId: string): Promise<string[]> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { alertEmail: true },
  });

  if (client?.alertEmail) return [client.alertEmail];

  const owners = await db.user.findMany({
    where: { clientId, role: "owner" },
    select: { email: true },
  });
  return owners.map((o) => o.email);
}

/**
 * F2 (audit) : alerte quand un client final répond après un handoff.
 * Le bot ne répond plus sur cette conversation — le patron doit rappeler.
 */
export async function sendHandoffReplyAlert(
  clientId: string,
  params: { callerNumber: string; messageBody: string }
): Promise<void> {
  const recipients = await resolveAlertRecipients(clientId);
  if (recipients.length === 0) {
    logger.warn({ clientId }, "sendHandoffReplyAlert: aucun destinataire email");
    return;
  }

  const { subject, html } = buildHandoffReplyAlertEmail(params);
  const { error } = await sendEmail({ from: FROM_EMAIL, to: recipients, subject, html });
  if (error) {
    throw new Error(`SMTP error: ${error.message}`);
  }
  logger.info({ clientId, recipientCount: recipients.length }, "Alerte réponse post-handoff envoyée");
}

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
