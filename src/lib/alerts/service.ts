import { db } from "@/lib/db";
import { sendEmail, FROM_EMAIL } from "@/lib/email/client";
import {
  buildLeadAlertEmail,
  buildInboundMessageAlertEmail,
  type LeadAlertParams,
} from "@/lib/email/templates";
import { sendSms } from "@/lib/sms/service";
import { logger } from "@/lib/logger";

/** Destinataires email d'un client : override `alertEmail`, sinon les owners. */
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
 * Alerte le patron qu'un client a écrit après qualification/transmission, alors
 * que le robot ne répond plus automatiquement (états `qualified`/`handed_off`).
 * Évite que ces messages tombent dans le vide.
 */
export async function sendInboundMessageAlert(
  clientId: string,
  callerNumber: string,
  body: string,
  afterHandoff: boolean
): Promise<void> {
  const recipients = await resolveAlertRecipients(clientId);
  if (recipients.length === 0) {
    logger.warn({ clientId }, "sendInboundMessageAlert: aucun destinataire — alerte non envoyée");
    return;
  }

  const { subject, html } = buildInboundMessageAlertEmail({ callerNumber, body, afterHandoff });
  const { error } = await sendEmail({ from: FROM_EMAIL, to: recipients, subject, html });
  if (error) {
    logger.error({ clientId, error: error.message }, "Échec alerte nouveau message");
    return;
  }
  logger.info({ clientId, callerNumber }, "Alerte nouveau message envoyée");
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
