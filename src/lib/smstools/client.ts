import { logger } from "@/lib/logger";

// smstools (smsgatewayapi.com) — passerelle SMS belge, ~0,06 €/SMS.
// Doc : https://www.smstools.com/en/sms-gateway-api
const SEND_URL = "https://api.smsgatewayapi.com/v1/message/send";

export interface SmstoolsSendParams {
  to: string; // numéro destinataire (format international, ex. +324...)
  sender: string; // numéro/expéditeur smstools (SMSTOOLS_SENDER)
  message: string; // corps du SMS (déjà assaini en 1 segment en amont)
}

/**
 * Envoie un SMS via l'API smstools. Retourne l'identifiant de message renvoyé
 * par la passerelle (stocké à titre de référence — non utilisé pour la logique).
 * Lève une exception si l'appel échoue.
 */
export async function smstoolsSend(params: SmstoolsSendParams): Promise<string> {
  const clientId = process.env.SMSTOOLS_CLIENT_ID;
  const clientSecret = process.env.SMSTOOLS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("SMSTOOLS_CLIENT_ID / SMSTOOLS_CLIENT_SECRET manquants");
  }

  const res = await fetch(SEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Client-Id": clientId,
      "X-Client-Secret": clientSecret,
    },
    body: JSON.stringify({
      message: params.message,
      to: params.to,
      sender: params.sender,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`smstools send échoué : ${res.status} ${text}`);
  }

  // La réponse contient un id de message ; le nom exact du champ peut varier
  // selon la version de l'API — on reste tolérant, l'id n'est que référentiel.
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const id =
    pick(data, "message_id") ??
    pick(data, "id") ??
    pick(data["data"], "message_id") ??
    pick(data["data"], "id") ??
    "";

  if (!id) {
    logger.warn({ data }, "smstools : id de message introuvable dans la réponse");
  }
  return String(id);
}

function pick(obj: unknown, key: string): string | undefined {
  if (obj && typeof obj === "object" && key in obj) {
    const v = (obj as Record<string, unknown>)[key];
    return v == null ? undefined : String(v);
  }
  return undefined;
}
