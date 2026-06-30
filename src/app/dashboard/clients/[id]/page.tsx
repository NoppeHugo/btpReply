import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { monthBoundsInTz } from "@/lib/time";
import ClientJournal from "./ClientJournal";
import ClientBilling from "./ClientBilling";

const STAGE_BADGE: Record<string, string> = {
  prospect: "bg-yellow-100 text-yellow-700",
  active: "bg-green-100 text-green-700",
  paused: "bg-gray-100 text-gray-500",
};

const CONV_STATE_LABEL: Record<string, string> = {
  open: "En cours",
  qualified: "Qualifié",
  handed_off: "Transmis",
  closed: "Fermé",
};

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/dashboard/calls");

  const { id } = await params;

  const client = await db.client.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      displayName: true,
      stage: true,
      timezone: true,
      plan: true,
      stripeCustomerId: true,
      createdAt: true,
      users: {
        select: { id: true, email: true, role: true },
      },
    },
  });

  if (!client) notFound();

  const now = new Date();
  const { start: monthStart, end: monthEnd } = monthBoundsInTz(
    client.timezone,
    now
  );

  const [callsTotal, callsMonth, leadsTotal, leadsMonth, conversations, notes] =
    await Promise.all([
      db.call.count({ where: { clientId: id } }),
      db.call.count({
        where: { clientId: id, calledAt: { gte: monthStart, lte: monthEnd } },
      }),
      db.lead.count({ where: { clientId: id } }),
      db.lead.count({
        where: { clientId: id, createdAt: { gte: monthStart, lte: monthEnd } },
      }),
      db.conversation.findMany({
        where: { clientId: id },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          callerNumber: true,
          state: true,
          turnCount: true,
          language: true,
          createdAt: true,
          lead: {
            select: {
              type: true,
              urgency: true,
              status: true,
              summary: true,
            },
          },
        },
      }),
      db.clientNote.findMany({
        where: { clientId: id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: { select: { email: true } },
        },
      }),
    ]);

  const displayName = client.displayName ?? client.name;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{displayName}</h1>
          {client.displayName && (
            <p className="text-sm text-gray-400">{client.name}</p>
          )}
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm ${
            STAGE_BADGE[client.stage] ?? ""
          }`}
        >
          {client.stage}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Appels total", value: callsTotal },
          { label: "Appels ce mois", value: callsMonth },
          { label: "Leads total", value: leadsTotal },
          { label: "Leads ce mois", value: leadsMonth },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-gray-200 bg-white p-4"
          >
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Users */}
      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-3 font-semibold text-gray-900">Utilisateurs</h2>
        {client.users.length === 0 ? (
          <p className="text-sm text-gray-400">Aucun utilisateur.</p>
        ) : (
          <ul className="space-y-1">
            {client.users.map((u) => (
              <li key={u.id} className="flex items-center gap-3 text-sm">
                <span className="font-medium text-gray-700">{u.email}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                  {u.role}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Conversations */}
      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-3 font-semibold text-gray-900">
          Dernières conversations
        </h2>
        {conversations.length === 0 ? (
          <p className="text-sm text-gray-400">Aucune conversation.</p>
        ) : (
          <div className="space-y-2">
            {conversations.map((c) => (
              <div
                key={c.id}
                className="flex items-start justify-between rounded-md bg-gray-50 px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-mono text-xs">{c.callerNumber}</span>
                  {c.lead?.summary && (
                    <p className="mt-0.5 text-xs text-gray-600">
                      {c.lead.summary}
                    </p>
                  )}
                </div>
                <div className="ml-4 shrink-0 text-right">
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                    {CONV_STATE_LABEL[c.state] ?? c.state}
                  </span>
                  <p className="mt-1 text-xs text-gray-400">
                    {new Date(c.createdAt).toLocaleDateString("fr-BE")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Billing */}
      <ClientBilling
        clientId={id}
        plan={client.plan}
        stripeCustomerId={client.stripeCustomerId}
      />

      {/* Journal (notes + message) — client component */}
      <ClientJournal
        clientId={id}
        initialNotes={notes.map((n) => ({
          id: n.id,
          body: n.body,
          createdAt: n.createdAt.toISOString(),
          authorEmail: n.author.email,
        }))}
      />
    </div>
  );
}
