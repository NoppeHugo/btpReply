import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";

const STAGE_BADGE: Record<string, string> = {
  prospect: "bg-yellow-100 text-yellow-700",
  active: "bg-green-100 text-green-700",
  paused: "bg-gray-100 text-gray-500",
};

export default async function ClientsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/dashboard/calls");

  const clients = await db.client.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      displayName: true,
      stage: true,
      timezone: true,
      createdAt: true,
      _count: {
        select: { calls: true, leads: true, users: true },
      },
    },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">
          Clients ({clients.length})
        </h1>
        <Link
          href="/dashboard/clients/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          + Nouveau client
        </Link>
      </div>

      {clients.length === 0 ? (
        <p className="text-sm text-gray-500">Aucun client pour l'instant.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Appels</th>
                <th className="px-4 py-3">Leads</th>
                <th className="px-4 py-3">Utilisateurs</th>
                <th className="px-4 py-3">Créé</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">
                      {c.displayName ?? c.name}
                    </p>
                    {c.displayName && (
                      <p className="text-xs text-gray-400">{c.name}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        STAGE_BADGE[c.stage] ?? ""
                      }`}
                    >
                      {c.stage}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c._count.calls}</td>
                  <td className="px-4 py-3 text-gray-600">{c._count.leads}</td>
                  <td className="px-4 py-3 text-gray-600">{c._count.users}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(c.createdAt).toLocaleDateString("fr-BE")}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/clients/${c.id}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Détail →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
