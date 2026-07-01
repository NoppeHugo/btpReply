import Link from "next/link";
import { PhoneMissed } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LandingNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-40">
      <div className="mx-auto mt-3 flex max-w-6xl items-center justify-between gap-4 rounded-full border border-white/10 bg-neutral-950/70 px-4 py-2.5 backdrop-blur-md sm:px-5">
        <Link href="/" className="flex items-center gap-2 text-white">
          <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500 text-neutral-950">
            <PhoneMissed className="size-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">Rappl</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-white/60 md:flex">
          <a href="#probleme" className="transition-colors hover:text-white">
            Le problème
          </a>
          <a href="#solution" className="transition-colors hover:text-white">
            La solution
          </a>
          <a href="#roi" className="transition-colors hover:text-white">
            Le calcul
          </a>
          <a href="#garantie" className="transition-colors hover:text-white">
            Garantie
          </a>
        </nav>

        <a
          href="#demo"
          className={cn(
            buttonVariants({ size: "sm" }),
            "rounded-full bg-amber-500 px-4 text-neutral-950 hover:bg-amber-400",
          )}
        >
          Réserver une démo
        </a>
      </div>
    </header>
  );
}
