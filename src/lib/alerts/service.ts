import { db } from "@/lib/db";
import { getResendClient, FROM_EMAIL } from "@/lib/email/client";
import { buildLeadAlertEmail, type LeadAlertParams } from "@/lib/email/templates";
import { logger } from "@/lib/logger";

export async function sendLeadAlert(
  clientId: string,
  params: LeadAlertParams
): Promise<void> {
  const owners = await db.user.findMany({
    where: { clientId, role: "owner" },
    select: { email: true },
  });

  if (owners.length === 0) {
    logger.warn({ clientId }, "sendLeadAlert: aucun owner trouvé — alerte non envoyée");
    return;
  }

  const { subject, html } = buildLeadAlertEmail(params);

  const { error } = await getResendClient().emails.send({
    from: FROM_EMAIL,
    to: owners.map((o) => o.email),
    subject,
    html,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  logger.info({ clientId, ownerCount: owners.length }, "Alerte lead envoyée");
}
