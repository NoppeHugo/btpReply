import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
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
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-gray-200 bg-white">
        <div className="flex h-16 items-center border-b border-gray-200 px-4">
          <span className="text-lg font-bold text-blue-600">btpReply</span>
        </div>

        <nav className="flex flex-col gap-1 p-3">
          {isAdmin && (
            <NavLink href="/dashboard/clients" label="👥 Clients" />
          )}
          <NavLink href="/dashboard/calls" label="📞 Appels" />
          <NavLink href="/dashboard/leads" label="✅ Leads" />
          <NavLink href="/dashboard/roi" label="📊 ROI" />
          {!isAdmin && (
            <NavLink href="/dashboard/config" label="⚙️ Config" />
          )}
        </nav>

        <div className="absolute bottom-0 w-56 border-t border-gray-200 p-3">
          <p className="mb-2 truncate text-xs text-gray-500">{session.user.email}</p>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="w-full rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
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
    <Link
      href={href}
      className="rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
    >
      {label}
    </Link>
  );
}
