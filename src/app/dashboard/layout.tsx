import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PhoneMissed } from "lucide-react";
import { signOut } from "@/auth";
import { SidebarNav, MobileTabBar, type NavItem } from "./nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = session.user.role === "admin";

  const items: NavItem[] = [
    ...(isAdmin
      ? [
          { href: "/dashboard/clients", label: "Clients", icon: "👥" },
          { href: "/dashboard/admin/checklist", label: "Go-live", icon: "🚀" },
        ]
      : []),
    { href: "/dashboard/calls", label: "Appels", icon: "📞" },
    { href: "/dashboard/leads", label: "Leads", icon: "✅" },
    { href: "/dashboard/roi", label: "ROI", icon: "📊" },
    ...(!isAdmin
      ? [{ href: "/dashboard/config", label: "Config", icon: "⚙️" }]
      : []),
  ];

  const signOutAction = async () => {
    "use server";
    await signOut({ redirectTo: "/login" });
  };

  const Logo = (
    <span className="flex items-center gap-2">
      <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500 text-neutral-950">
        <PhoneMissed className="size-4" />
      </span>
      <span className="text-sm font-semibold tracking-tight text-white">
        Rappl
      </span>
    </span>
  );

  return (
    <div className="app-shell lg:flex">
      {/* Sidebar (desktop) */}
      <aside className="relative hidden w-56 shrink-0 flex-col border-r border-white/10 bg-neutral-950 lg:flex">
        <div className="flex h-16 items-center gap-2 border-b border-white/10 px-4">
          {Logo}
        </div>

        <SidebarNav items={items} />

        <div className="mt-auto border-t border-white/10 p-3">
          <p className="mb-2 truncate text-xs text-white/40">
            {session.user.email}
          </p>
          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full rounded-lg px-3 py-1.5 text-left text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-white"
            >
              Déconnexion
            </button>
          </form>
        </div>
      </aside>

      {/* Top header (mobile) */}
      <header className="flex h-14 items-center justify-between border-b border-white/10 bg-neutral-950 px-4 lg:hidden">
        {Logo}
        <form action={signOutAction}>
          <button
            type="submit"
            className="rounded-lg px-3 py-1.5 text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-white"
          >
            Déconnexion
          </button>
        </form>
      </header>

      {/* Main */}
      <main className="flex-1 overflow-auto p-4 pb-24 lg:p-6 lg:pb-6">
        {children}
      </main>

      {/* Bottom tab bar (mobile) */}
      <MobileTabBar items={items} />
    </div>
  );
}
