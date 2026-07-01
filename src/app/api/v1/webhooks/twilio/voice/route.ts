import { NextRequest } from "next/server";
import { twiml } from "twilio";
import { validateTwilioSignature } from "@/lib/twilio/signature";
import { handleIncomingCall, scheduleInitialSms } from "@/lib/calls/service";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  // --- Vérification signature Twilio (règle dure §4-3) ---
  const signature = req.headers.get("x-twilio-signature") ?? "";
  const url = `${process.env.APP_BASE_URL}/api/v1/webhooks/twilio/voice`;
  const body = await req.formData();
  const params = Object.fromEntries(
    [...body.entries()].map(([k, v]) => [k, String(v)])
  );

  if (!validateTwilioSignature(url, params, signature)) {
    logger.warn("Webhook Voice rejeté — signature invalide");
    return new Response("Forbidden", { status: 403 });
  }

  const twilioCallSid = params["CallSid"] ?? "";
  const callerNumber = params["From"] ?? "";
  const toNumber = params["To"] ?? "";

  // --- Création du Call + SMS différé (P1-T3/T4/T5, P2-T2) ---
  const callResult = await handleIncomingCall({
    twilioCallSid,
    callerNumber,
    toNumber,
    calledAt: new Date(),
  });

  if (callResult) {
    scheduleInitialSms(
      callResult.callId,
      callResult.clientId,
      callerNumber,
      callResult.fromNumber
    ).catch((err) =>
      logger.error({ err, callId: callResult.callId }, "Erreur planification SMS initial")
    );
  }

  // --- Réponse TwiML : message bref + raccrochage ---
  const response = new twiml.VoiceResponse();
  response.say(
    { language: "fr-FR", voice: "Polly.Lea" },
    "Merci d'avoir appelé. Vous allez recevoir un message dans quelques instants."
  );
  response.hangup();

  return new Response(response.toString(), {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
