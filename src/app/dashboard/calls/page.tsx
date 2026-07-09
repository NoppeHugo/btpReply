import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import { KnownNumberButton } from "@/components/KnownNumberButton";

const STATE_LABEL: Record<string, string> = {
  open: "En cours",
  qualified: "Qualifié",
  handed_off: "Transmis",
  closed: "Fermé",
};

const URGENCY_BADGE: Record<string, string> = {
  low: "bg-white/10 text-white/60",
  medium: "bg-amber-500/15 text-amber-300",
  high: "bg-red-500/15 text-red-400",
};

export default async function CallsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const where =
    session.user.role === "admin" ? {} : { clientId: session.user.clientId };

  const calls = await db.call.findMany({
    where,
    orderBy: { calledAt: "desc" },
    take: 100,
    select: {
      id: true,
      callerNumber: true,
      calledAt: true,
      client: { select: { name: true, displayName: true } },
      conversation: {
        select: {
          id: true,
          state: true,
          lead: { select: { type: true, urgency: true, status: true } },
        },
      },
    },
  });

  return (
    <div>
      <h1 className="app-h1 mb-6">Appels captés</h1>

      {calls.length === 0 ? (
        <p className="app-muted text-sm">Aucun appel pour l&apos;instant.</p>
      ) : (
        <>
        {/* Cartes (mobile) */}
        <div className="space-y-3 md:hidden">
          {calls.map((call) => {
            const lead = call.conversation?.lead;
            const card = (
              <div className="app-card-sm">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-mono text-sm text-white">
                    {call.callerNumber}
                  </span>
                  {lead?.urgency ? (
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                        URGENCY_BADGE[lead.urgency] ?? ""
                      }`}
                    >
                      {lead.urgency}
                    </span>
                  ) : (
                    <span className="pill shrink-0">
                      {call.conversation
                        ? (STATE_LABEL[call.conversation.state] ??
                          call.conversation.state)
                        : "—"}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/60">
                  {session.user.role === "admin" && (
                    <span>{call.client.displayName ?? call.client.name}</span>
                  )}
                  {lead?.type && <span>{lead.type}</span>}
                  {lead?.status && <span>Lead : {lead.status}</span>}
                  <span className="text-white/30">
                    {new Date(call.calledAt).toLocaleString("fr-BE", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            );
            return (
              <div key={call.id}>
                {call.conversation ? (
                  <Link
                    href={`/dashboard/conversations/${call.conversation.id}`}
                    className="block transition-colors hover:opacity-80"
                  >
                    {card}
                  </Link>
                ) : (
                  card
                )}
                {session.user.role !== "admin" && (
                  <div className="mt-1 pl-1">
                    <KnownNumberButton number={call.callerNumber} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Table (desktop) */}
        <div className="hidden overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03] md:block">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 bg-white/[0.02]">
              <tr>
                <th className="app-th">Numéro</th>
                {session.user.role === "admin" && <th className="app-th">Client</th>}
                <th className="app-th">Date</th>
                <th className="app-th">État conv.</th>
                <th className="app-th">Type</th>
                <th className="app-th">Urgence</th>
                <th className="app-th">Statut lead</th>
                <th className="app-th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {calls.map((call) => {
                const lead = call.conversation?.lead;
                return (
                  <tr key={call.id} className="transition-colors hover:bg-white/[0.02]">
                    <td className="app-td font-mono text-xs text-white">{call.callerNumber}</td>
                    {session.user.role === "admin" && (
                      <td className="app-td">
                        {call.client.displayName ?? call.client.name}
                      </td>
                    )}
                    <td className="app-td text-white/60">
                      {new Date(call.calledAt).toLocaleString("fr-BE", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="app-td">
                      <span className="pill">
                        {call.conversation
                          ? (STATE_LABEL[call.conversation.state] ?? call.conversation.state)
                          : "—"}
                      </span>
                    </td>
                    <td className="app-td text-white/60">{lead?.type ?? "—"}</td>
                    <td className="app-td">
                      {lead?.urgency ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            URGENCY_BADGE[lead.urgency] ?? ""
                          }`}
                        >
                          {lead.urgency}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="app-td text-white/60">{lead?.status ?? "—"}</td>
                    <td className="app-td">
                      <div className="flex items-center gap-3">
                        {call.conversation && (
                          <Link
                            href={`/dashboard/conversations/${call.conversation.id}`}
                            className="text-xs font-medium text-amber-400 hover:underline"
                          >
                            Voir →
                          </Link>
                        )}
                        {session.user.role !== "admin" && (
                          <KnownNumberButton number={call.callerNumber} />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
