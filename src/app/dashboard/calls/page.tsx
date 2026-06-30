import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";

const STATE_LABEL: Record<string, string> = {
  open: "En cours",
  qualified: "Qualifié",
  handed_off: "Transmis",
  closed: "Fermé",
};

const URGENCY_BADGE: Record<string, string> = {
  low: "bg-gray-100 text-gray-700",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-red-100 text-red-700",
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
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Appels captés</h1>

      {calls.length === 0 ? (
        <p className="text-sm text-gray-500">Aucun appel pour l'instant.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Numéro</th>
                {session.user.role === "admin" && <th className="px-4 py-3">Client</th>}
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">État conv.</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Urgence</th>
                <th className="px-4 py-3">Statut lead</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {calls.map((call) => {
                const lead = call.conversation?.lead;
                return (
                  <tr key={call.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{call.callerNumber}</td>
                    {session.user.role === "admin" && (
                      <td className="px-4 py-3 text-gray-600">
                        {call.client.displayName ?? call.client.name}
                      </td>
                    )}
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(call.calledAt).toLocaleString("fr-BE", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                        {call.conversation
                          ? (STATE_LABEL[call.conversation.state] ?? call.conversation.state)
                          : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{lead?.type ?? "—"}</td>
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3 text-gray-600">{lead?.status ?? "—"}</td>
                    <td className="px-4 py-3">
                      {call.conversation && (
                        <Link
                          href={`/dashboard/conversations/${call.conversation.id}`}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Voir →
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
