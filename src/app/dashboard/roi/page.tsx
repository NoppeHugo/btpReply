import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { dayBoundsInTz, monthBoundsInTz } from "@/lib/time";

const DEFAULT_TZ = "Europe/Brussels";
const AVG_CUSTOMER_VALUE = 800; // € — configurable assumption

export default async function RoiPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const clientId =
    session.user.role === "admin" ? undefined : session.user.clientId;

  const now = new Date();
  const { start: dayStart, end: dayEnd } = dayBoundsInTz(DEFAULT_TZ, now);
  const { start: monthStart, end: monthEnd } = monthBoundsInTz(DEFAULT_TZ, now);

  const callsWhere = clientId ? { clientId } : {};
  const leadsWhere = clientId ? { clientId } : {};

  const [
    callsToday,
    callsMonth,
    callsTotal,
    leadsTotal,
    leadsDone,
    leadsMonth,
  ] = await Promise.all([
    db.call.count({
      where: { ...callsWhere, calledAt: { gte: dayStart, lte: dayEnd } },
    }),
    db.call.count({
      where: { ...callsWhere, calledAt: { gte: monthStart, lte: monthEnd } },
    }),
    db.call.count({ where: callsWhere }),
    db.lead.count({ where: leadsWhere }),
    db.lead.count({ where: { ...leadsWhere, status: "done" } }),
    db.lead.count({
      where: { ...leadsWhere, createdAt: { gte: monthStart, lte: monthEnd } },
    }),
  ]);

  const conversionRate =
    leadsTotal > 0 ? Math.round((leadsDone / leadsTotal) * 100) : 0;
  const estimatedRevenue = leadsDone * AVG_CUSTOMER_VALUE;

  const stats = [
    {
      label: "Appels captés aujourd'hui",
      value: callsToday,
      sub: `${callsMonth} ce mois`,
      color: "text-white",
    },
    {
      label: "Leads générés (total)",
      value: leadsTotal,
      sub: `${leadsMonth} ce mois`,
      color: "text-white",
    },
    {
      label: "Leads traités",
      value: leadsDone,
      sub: `Taux de conversion ${conversionRate}%`,
      color: "text-emerald-400",
    },
    {
      label: "Chiffre d'affaires estimé",
      value: `${estimatedRevenue.toLocaleString("fr-BE")} €`,
      sub: `Basé sur ${AVG_CUSTOMER_VALUE} € / client`,
      color: "text-amber-400",
    },
    {
      label: "Appels captés (total)",
      value: callsTotal,
      sub: "Depuis le lancement",
      color: "text-white",
    },
  ];

  return (
    <div>
      <h1 className="app-h1 mb-6">ROI &amp; Statistiques</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="app-card">
            <p className="mb-1 text-sm text-white/50">{s.label}</p>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="mt-1 text-xs text-white/30">{s.sub}</p>
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs text-white/30">
        * Les estimations de chiffre d&apos;affaires sont basées sur une valeur
        moyenne de {AVG_CUSTOMER_VALUE} € par client. Cette valeur peut être
        ajustée selon votre secteur.
      </p>
    </div>
  );
}
