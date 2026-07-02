import "dotenv/config";
import { db } from "../../src/lib/db";
import { buildClientRecap } from "../../src/lib/recap/service";
import { buildDailyRecapEmail } from "../../src/lib/email/templates";
import { sendEmail, FROM_EMAIL } from "../../src/lib/email/client";
import { logger } from "../../src/lib/logger";

export async function runDailyRecap(): Promise<void> {
  const now = new Date();
  logger.info({ now: now.toISOString() }, "Récap quotidien démarré");

  // Envoyer un récap uniquement aux clients actifs
  const clients = await db.client.findMany({
    where: { stage: "active" },
    select: { id: true },
  });

  let sent = 0;
  let errors = 0;

  for (const { id: clientId } of clients) {
    try {
      const payload = await buildClientRecap(clientId, now);
      if (!payload) continue;

      const { subject, html } = buildDailyRecapEmail(payload.data);

      const { error } = await sendEmail({
        from: FROM_EMAIL,
        to: payload.ownerEmails,
        subject,
        html,
      });

      if (error) throw new Error(error.message);

      logger.info({ clientId }, "Récap envoyé");
      sent++;
    } catch (err) {
      logger.error({ err, clientId }, "Erreur récap quotidien pour ce client");
      errors++;
    }
  }

  logger.info({ sent, errors, total: clients.length }, "Récap quotidien terminé");
}
