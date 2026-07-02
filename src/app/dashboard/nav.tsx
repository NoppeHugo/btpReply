"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; icon: string };

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

/** Liens verticaux de la sidebar (desktop). */
export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 p-3">
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          className={`nav-link ${
            isActive(pathname, it.href) ? "bg-white/5 text-white" : ""
          }`}
        >
          <span className="mr-1.5">{it.icon}</span>
          {it.label}
        </Link>
      ))}
    </nav>
  );
}

/** Barre d'onglets fixée en bas (mobile). */
export function MobileTabBar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/10 bg-neutral-950/95 backdrop-blur lg:hidden">
      {items.map((it) => {
        const active = isActive(pathname, it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 transition-colors ${
              active ? "text-amber-400" : "text-white/50 hover:text-white"
            }`}
          >
            <span className="text-lg leading-none">{it.icon}</span>
            <span className="max-w-full truncate text-[10px] font-medium">
              {it.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
