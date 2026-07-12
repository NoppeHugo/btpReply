import { ok, err } from "@/lib/api/response";
import { getVapidPublicKey } from "@/lib/push/service";

// GET /api/v1/push/key — clé publique VAPID (nécessaire pour s'abonner).
// Publique par nature (elle est embarquée dans chaque abonnement navigateur).
export async function GET() {
  const key = getVapidPublicKey();
  if (!key) return err("Notifications push non configurées", 501, "PUSH_DISABLED");
  return ok({ key });
}
