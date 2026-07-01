import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { checkEnv } from "@/lib/env";

async function checkDb(): Promise<{ ok: boolean; latencyMs: number }> {
  try {
    const t0 = Date.now();
    await db.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - t0 };
  } catch {
    return { ok: false, latencyMs: 0 };
  }
}

async function checkClients() {
  const clients = await db.client.findMany({
    where: { stage: "active" },
    select: {
      id: true,
      name: true,
      displayName: true,
      phoneNumbers: { where: { active: true }, select: { id: true } },
      users: { where: { role: "owner" }, select: { id: true } },
      businessHours: { select: { id: true }, take: 1 },
    },
  });

  return clients.map((c) => ({
    id: c.id,
    name: c.displayName ?? c.name,
    hasPhone: c.phoneNumbers.length > 0,
    hasOwner: c.users.length > 0,
    hasHours: c.businessHours.length > 0,
  }));
}

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        ok
          ? "bg-emerald-500/15 text-emerald-300"
          : "bg-red-500/15 text-red-400"
      }`}
    >
      {ok ? "✓" : "✗"} {label}
    </span>
  );
}

export default async function ChecklistPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/dashboard/calls");

  const [dbResult, envStatus, activeClients] = await Promise.all([
    checkDb(),
    Promise.resolve(checkEnv()),
    checkClients(),
  ]);

  const requiredEnv = envStatus.filter((e) => e.required);
  const optionalEnv = envStatus.filter((e) => !e.required);
  const allRequiredSet = requiredEnv.every((e) => e.set);
  const globalOk = dbResult.ok && allRequiredSet;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="app-h1">Checklist go-live</h1>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${
            globalOk
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-red-500/15 text-red-400"
          }`}
        >
          {globalOk ? "Prêt pour la production" : "Action requise"}
        </span>
      </div>

      {/* DB */}
      <section className="app-card">
        <h2 className="app-h2 mb-3">Base de données</h2>
        <div className="flex items-center gap-3">
          <Badge ok={dbResult.ok} label={dbResult.ok ? `Connecté (${dbResult.latencyMs} ms)` : "Inaccessible"} />
        </div>
      </section>

      {/* Env vars */}
      <section className="app-card">
        <h2 className="app-h2 mb-3">Variables d&apos;environnement</h2>
        <div className="mb-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-white/40">
            Requises
          </p>
          <div className="flex flex-wrap gap-2">
            {requiredEnv.map((e) => (
              <div key={e.key} className="flex flex-col gap-0.5">
                <Badge ok={e.set} label={e.key} />
                <span className="pl-1 text-[10px] text-white/40">{e.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-white/40">
            Optionnelles
          </p>
          <div className="flex flex-wrap gap-2">
            {optionalEnv.map((e) => (
              <div key={e.key} className="flex flex-col gap-0.5">
                <Badge ok={e.set} label={e.key} />
                <span className="pl-1 text-[10px] text-white/40">{e.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Clients actifs */}
      <section className="app-card">
        <h2 className="app-h2 mb-3">
          Clients actifs ({activeClients.length})
        </h2>
        {activeClients.length === 0 ? (
          <p className="text-sm text-white/40">
            Aucun client en stage <code>active</code> — onboardez le premier client.
          </p>
        ) : (
          <div className="space-y-3">
            {activeClients.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
              >
                <span className="text-sm font-medium text-white/80">{c.name}</span>
                <div className="flex gap-2">
                  <Badge ok={c.hasPhone} label="Numéro Twilio" />
                  <Badge ok={c.hasOwner} label="Compte owner" />
                  <Badge ok={c.hasHours} label="Horaires" />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Checklist manuelle */}
      <section className="app-card">
        <h2 className="app-h2 mb-3">Checklist manuelle</h2>
        <ul className="space-y-2 text-sm text-white/70">
          {[
            "Numéro Twilio +32 acheté et configuré en renvoi conditionnel chez le client (P1-T1)",
            "Webhook Voice URL : https://[domaine]/api/v1/webhooks/twilio/voice",
            "Webhook SMS URL : https://[domaine]/api/v1/webhooks/twilio/sms",
            "Stripe : produits 'btpReply Base' et 'btpReply Plus' créés + price IDs dans .env",
            "Sentry : projet créé, SENTRY_DSN renseigné, alertes email configurées",
            "Caddy : TLS automatique actif, domaine pointé vers le VPS",
            "Docker Compose prod : `docker compose up -d` sur le VPS",
            "Migration DB prod : `pnpm db:migrate` ou `prisma migrate deploy`",
            "Seed admin prod : `pnpm db:seed` avec SEED_ADMIN_PASSWORD fort",
          ].map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-0.5 text-white/30">☐</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
