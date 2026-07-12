import webpush from "web-push";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

// Web Push (VAPID). Optionnel : sans clés configurées, tout est no-op.
// Générer les clés : npx web-push generate-vapid-keys

export function isPushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
  );
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

let vapidReady = false;
function ensureVapid(): boolean {
  if (!isPushConfigured()) return false;
  if (!vapidReady) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? "mailto:contact@rappl.be",
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );
    vapidReady = true;
  }
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Chemin ouvert au clic sur la notification. */
  url?: string;
}

/**
 * Envoie une notification à tous les appareils abonnés d'un client.
 * Les abonnements morts (endpoint expiré → 404/410) sont purgés au passage.
 */
export async function sendPushToClient(
  clientId: string,
  payload: PushPayload
): Promise<void> {
  if (!ensureVapid()) return;

  const subs = await db.pushSubscription.findMany({
    where: { clientId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (subs.length === 0) return;

  const body = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.pushSubscription
            .delete({ where: { id: sub.id } })
            .catch(() => {});
          logger.info({ clientId }, "Abonnement push expiré purgé");
        } else {
          logger.error({ err, clientId }, "Échec envoi notification push");
        }
      }
    })
  );

  logger.info({ clientId, count: subs.length }, "Notifications push envoyées");
}
