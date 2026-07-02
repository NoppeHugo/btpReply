import Link from "next/link";
import { PhoneMissed } from "lucide-react";
import { CONTACT_EMAIL } from "@/lib/site";

export default function LegalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500 text-neutral-950">
              <PhoneMissed className="size-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight">Rappl</span>
          </Link>
          <Link href="/" className="text-sm text-white/60 hover:text-white">
            ← Retour au site
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12 [&_a]:text-amber-400 [&_a]:underline [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_li]:mt-1.5 [&_p]:mt-4 [&_p]:leading-relaxed [&_p]:text-white/70 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:text-white/70">
        {children}
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-8 text-sm text-white/40">
          <Link href="/mentions-legales" className="hover:text-white">
            Mentions légales
          </Link>
          <Link href="/confidentialite" className="hover:text-white">
            Confidentialité
          </Link>
          <Link href="/cgv" className="hover:text-white">
            CGV
          </Link>
          <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-white">
            {CONTACT_EMAIL}
          </a>
        </div>
      </footer>
    </div>
  );
}
