import { db } from "@/lib/db";
import { dayBoundsInTz, monthBoundsInTz } from "@/lib/time";
import type { RecapData } from "@/lib/email/templates";

export interface ClientRecapPayload {
  clientId: string;
  ownerEmails: string[];
  data: RecapData;
}

/**
 * P4-T3/T4 : construit les stats du récap quotidien pour un client.
 * Retourne null si aucun owner n'est associé au client.
 */
export async function buildClientRecap(
  clientId: string,
  now: Date
): Promise<ClientRecapPayload | null> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: {
      name: true,
      timezone: true,
      users: { where: { role: "owner" }, select: { email: true } },
    },
  });

  if (!client || client.users.length === 0) return null;

  const tz = client.timezone;
  const { start: dayStart, end: dayEnd } = dayBoundsInTz(tz, now);
  const { start: monthStart, end: monthEnd } = monthBoundsInTz(tz, now);

  // P4-T3 : appels captés aujourd'hui / ce mois
  const [todayCalls, monthCalls] = await Promise.all([
    db.call.count({
      where: { clientId, calledAt: { gte: dayStart, lte: dayEnd } },
    }),
    db.call.count({
      where: { clientId, calledAt: { gte: monthStart, lte: monthEnd } },
    }),
  ]);

  // P4-T3 : leads qualifiés aujourd'hui / ce mois.
  // `partial: false` → les leads partiels (conversations abandonnées) ne gonflent
  // pas le compteur ROI ; ils restent visibles via `toCallback` et la liste.
  const [todayLeads, monthLeads] = await Promise.all([
    db.lead.count({
      where: { clientId, partial: false, createdAt: { gte: dayStart, lte: dayEnd } },
    }),
    db.lead.count({
      where: { clientId, partial: false, createdAt: { gte: monthStart, lte: monthEnd } },
    }),
  ]);

  // P4-T3 : leads en attente de rappel (tous, pas seulement aujourd'hui)
  const toCallback = await db.lead.count({
    where: { clientId, status: "to_callback" },
  });

  // Liste détaillée des leads du jour (pour rappel direct depuis l'email).
  // Les urgents d'abord (enum trié high→low en desc), puis les plus récents.
  const leadRows = await db.lead.findMany({
    where: { clientId, createdAt: { gte: dayStart, lte: dayEnd } },
    orderBy: [{ urgency: "desc" }, { createdAt: "desc" }],
    select: {
      type: true,
      urgency: true,
      summary: true,
      status: true,
      partial: true,
      conversation: { select: { callerNumber: true } },
    },
  });

  const leads = leadRows.map((l) => ({
    callerNumber: l.conversation.callerNumber,
    type: l.type,
    urgency: l.urgency,
    summary: l.summary,
    status: l.status,
    partial: l.partial,
  }));

  // Label de date lisible en FR (ex: "lundi 30 juin 2026")
  const dateLabel = now.toLocaleDateString("fr-BE", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return {
    clientId,
    ownerEmails: client.users.map((u) => u.email),
    data: {
      clientName: client.name,
      dateLabel,
      today: {
        callsCaptured: todayCalls,
        leadsQualified: todayLeads,
        leadsToCallback: toCallback,
      },
      leads,
      month: {
        callsCaptured: monthCalls,
        leadsQualified: monthLeads,
      },
    },
  };
}
