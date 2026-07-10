import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import { Phone, ClipboardList, Users, Plus } from "lucide-react";

const STAGE_BADGE: Record<string, string> = {
  prospect: "bg-amber-500/15 text-amber-300",
  active: "bg-emerald-500/15 text-emerald-300",
  paused: "bg-white/10 text-white/50",
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="app-h1">Clients ({clients.length})</h1>
        <Link href="/dashboard/clients/new" className="btn-primary">
          <Plus className="size-4" /> Nouveau client
        </Link>
      </div>

      {clients.length === 0 ? (
        <p className="app-muted text-sm">Aucun client pour l&apos;instant.</p>
      ) : (
        <>
        {/* Cartes (mobile) */}
        <div className="space-y-3 md:hidden">
          {clients.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/clients/${c.id}`}
              className="app-card-sm block transition-colors hover:bg-white/[0.05]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">
                    {c.displayName ?? c.name}
                  </p>
                  {c.displayName && (
                    <p className="truncate text-xs text-white/40">{c.name}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                    STAGE_BADGE[c.stage] ?? ""
                  }`}
                >
                  {c.stage}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/60">
                <span className="flex items-center gap-1">
                  <Phone className="size-3" /> {c._count.calls} appels
                </span>
                <span className="flex items-center gap-1">
                  <ClipboardList className="size-3" /> {c._count.leads} leads
                </span>
                <span className="flex items-center gap-1">
                  <Users className="size-3" /> {c._count.users} users
                </span>
                <span className="text-white/30">
                  {new Date(c.createdAt).toLocaleDateString("fr-BE")}
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* Table (desktop) */}
        <div className="hidden overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03] md:block">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 bg-white/[0.02]">
              <tr>
                <th className="app-th">Client</th>
                <th className="app-th">Statut</th>
                <th className="app-th">Appels</th>
                <th className="app-th">Leads</th>
                <th className="app-th">Utilisateurs</th>
                <th className="app-th">Créé</th>
                <th className="app-th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {clients.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-white/[0.02]">
                  <td className="app-td">
                    <p className="font-medium text-white">
                      {c.displayName ?? c.name}
                    </p>
                    {c.displayName && (
                      <p className="text-xs text-white/40">{c.name}</p>
                    )}
                  </td>
                  <td className="app-td">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        STAGE_BADGE[c.stage] ?? ""
                      }`}
                    >
                      {c.stage}
                    </span>
                  </td>
                  <td className="app-td text-white/60">{c._count.calls}</td>
                  <td className="app-td text-white/60">{c._count.leads}</td>
                  <td className="app-td text-white/60">{c._count.users}</td>
                  <td className="app-td text-xs text-white/40">
                    {new Date(c.createdAt).toLocaleDateString("fr-BE")}
                  </td>
                  <td className="app-td">
                    <Link
                      href={`/dashboard/clients/${c.id}`}
                      className="text-xs font-medium text-amber-400 hover:underline"
                    >
                      Détail →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
