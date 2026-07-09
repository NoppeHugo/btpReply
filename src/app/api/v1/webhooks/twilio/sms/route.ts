import { NextRequest } from "next/server";
import { twiml } from "twilio";
import { validateTwilioSignature } from "@/lib/twilio/signature";
import { enqueueInboundSms } from "@/lib/conversations/inbound-queue";
import { logger } from "@/lib/logger";

// Webhook « A message comes in » de Twilio (SMS entrant).
// Sécurisé par la signature X-Twilio-Signature (même mécanisme que la voix) —
// plus robuste qu'un token en query string.
//
// Adaptateur mince : validation signature, extraction du payload
// (application/x-www-form-urlencoded), mise en file. Le worker draine la file et
// exécute le pipeline de qualification LLM hors du chemin HTTP (évite les
// timeouts → retries). Toute la logique métier vit dans les services, testable.

export async function POST(req: NextRequest) {
  // ── Sécurité : signature Twilio ──────────────────────────────────────
  const signature = req.headers.get("x-twilio-signature") ?? "";
  const url = `${process.env.APP_BASE_URL}/api/v1/webhooks/twilio/sms`;
  const body = await req.formData();
  const params = Object.fromEntries(
    [...body.entries()].map(([k, v]) => [k, String(v)])
  );

  if (!validateTwilioSignature(url, params, signature)) {
    logger.warn("Webhook SMS Twilio rejeté — signature invalide");
    return new Response("Forbidden", { status: 403 });
  }

  // From = appelant, To = notre numéro Twilio (clé de routage du pool collant),
  // MessageSid = clé d'idempotence.
  await enqueueInboundSms({
    callerNumber: params["From"] ?? "",
    receiver: params["To"] || undefined,
    messageBody: params["Body"] ?? "",
    providerMessageId: params["MessageSid"] || undefined,
  });

  // TwiML vide : accusé de réception. On ne répond pas de façon synchrone — la
  // réponse part du worker après qualification LLM.
  const response = new twiml.MessagingResponse();
  return new Response(response.toString(), {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
