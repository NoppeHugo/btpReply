import { db } from "@/lib/db";
import { checkEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const envStatus = checkEnv();
  const missingRequired = envStatus.filter((e) => e.required && !e.set);

  let dbOk = false;
  let dbLatencyMs = 0;

  try {
    const t0 = Date.now();
    await db.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - t0;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const healthy = dbOk && missingRequired.length === 0;

  const payload = {
    status: healthy ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    db: { ok: dbOk, latencyMs: dbLatencyMs },
    env: {
      ok: missingRequired.length === 0,
      missing: missingRequired.map((e) => e.key),
    },
  };

  return Response.json(payload, { status: healthy ? 200 : 503 });
}
