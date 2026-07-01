import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PhoneMissed } from "lucide-react";
import { signOut } from "@/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = session.user.role === "admin";

  return (
    <div className="app-shell flex">
      {/* Sidebar */}
      <aside className="relative flex w-56 shrink-0 flex-col border-r border-white/10 bg-neutral-950">
        <div className="flex h-16 items-center gap-2 border-b border-white/10 px-4">
          <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500 text-neutral-950">
            <PhoneMissed className="size-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight text-white">
            Rappl
          </span>
        </div>

        <nav className="flex flex-col gap-1 p-3">
          {isAdmin && <NavLink href="/dashboard/clients" label="👥 Clients" />}
          {isAdmin && (
            <NavLink href="/dashboard/admin/checklist" label="🚀 Go-live" />
          )}
          <NavLink href="/dashboard/calls" label="📞 Appels" />
          <NavLink href="/dashboard/leads" label="✅ Leads" />
          <NavLink href="/dashboard/roi" label="📊 ROI" />
          {!isAdmin && <NavLink href="/dashboard/config" label="⚙️ Config" />}
        </nav>

        <div className="mt-auto border-t border-white/10 p-3">
          <p className="mb-2 truncate text-xs text-white/40">
            {session.user.email}
          </p>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="w-full rounded-lg px-3 py-1.5 text-left text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-white"
            >
              Déconnexion
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="nav-link">
      {label}
    </Link>
  );
}
