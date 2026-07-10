"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  Rocket,
  Phone,
  ClipboardList,
  ChartColumn,
  Settings,
  type LucideIcon,
} from "lucide-react";

// Les icônes Lucide sont des composants React (non sérialisables serveur →
// client) : les items de nav sont donc définis ici, côté client, et le layout
// serveur ne passe que le rôle.
type NavItem = { href: string; label: string; icon: LucideIcon };

function navItems(isAdmin: boolean): NavItem[] {
  return [
    ...(isAdmin
      ? [
          { href: "/dashboard/clients", label: "Clients", icon: Users },
          { href: "/dashboard/admin/checklist", label: "Go-live", icon: Rocket },
        ]
      : []),
    { href: "/dashboard/calls", label: "Appels", icon: Phone },
    { href: "/dashboard/leads", label: "Leads", icon: ClipboardList },
    { href: "/dashboard/roi", label: "ROI", icon: ChartColumn },
    ...(!isAdmin
      ? [{ href: "/dashboard/config", label: "Config", icon: Settings }]
      : []),
  ];
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

/** Liens verticaux de la sidebar (desktop). */
export function SidebarNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 p-3">
      {navItems(isAdmin).map((it) => (
        <Link
          key={it.href}
          href={it.href}
          className={`nav-link flex items-center gap-2.5 ${
            isActive(pathname, it.href) ? "bg-white/5 text-white" : ""
          }`}
        >
          <it.icon className="size-4 shrink-0" strokeWidth={1.75} />
          {it.label}
        </Link>
      ))}
    </nav>
  );
}

/** Barre d'onglets fixée en bas (mobile). */
export function MobileTabBar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-neutral-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="flex">
        {navItems(isAdmin).map((it) => {
          const active = isActive(pathname, it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex min-w-0 flex-1 flex-col items-center gap-1 pb-2 pt-2.5 transition-colors ${
                active ? "text-amber-400" : "text-white/50 active:text-white"
              }`}
            >
              <it.icon
                className="size-5"
                strokeWidth={active ? 2.25 : 1.75}
              />
              <span className="max-w-full truncate text-[10px] font-medium">
                {it.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
