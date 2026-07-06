import { NextRequest } from "next/server";
import { enqueueInboundSms } from "@/lib/conversations/inbound-queue";
import { logger } from "@/lib/logger";

// Webhook « inbox_message » de smstools (SMS entrant).
// smstools ne signe pas ses webhooks (pas de HMAC documenté) : on sécurise par
// un token secret passé en query string dans l'URL de callback configurée côté
// smstools : https://.../api/v1/webhooks/smstools/inbound?token=SMSTOOLS_WEBHOOK_SECRET
//
// Ce handler reste un adaptateur mince : validation du token, extraction du
// payload, mise en file. Le worker draine la file et exécute le pipeline de
// qualification LLM hors du chemin de la requête HTTP (évite les timeouts →
// retries). Toute la logique métier vit dans les services et reste testable.

interface InboxPayload {
  webhook_type?: string;
  message?: {
    id?: string | number;
    sender?: string; // numéro du client (appelant)
    receiver?: string; // notre numéro smstools partagé
    content?: string;
  };
}

// Acquittement standard : on répond toujours 200 pour un webhook traité (même
// ignoré), afin que smstools ne retente pas. Seul un token invalide renvoie 403.
const ACK = () => new Response("", { status: 200 });

export async function POST(req: NextRequest) {
  // ── Sécurité : token secret dans l'URL ───────────────────────────────
  const secret = process.env.SMSTOOLS_WEBHOOK_SECRET;
  const token = req.nextUrl.searchParams.get("token");
  if (!secret || token !== secret) {
    logger.warn("Webhook smstools rejeté — token invalide");
    return new Response("Forbidden", { status: 403 });
  }

  let payload: InboxPayload;
  try {
    payload = (await req.json()) as InboxPayload;
  } catch {
    logger.warn("Webhook smstools — corps JSON illisible");
    return ACK();
  }

  // On ne traite que les messages entrants.
  if (payload.webhook_type && payload.webhook_type !== "inbox_message") {
    logger.info({ type: payload.webhook_type }, "Webhook smstools ignoré (type non géré)");
    return ACK();
  }

  await enqueueInboundSms({
    callerNumber: payload.message?.sender ?? "",
    receiver: payload.message?.receiver || undefined,
    messageBody: payload.message?.content ?? "",
    providerMessageId:
      payload.message?.id != null ? String(payload.message.id) : undefined,
  });

  return ACK();
}
