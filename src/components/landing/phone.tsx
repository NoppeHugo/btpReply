import {
  BellRing,
  CheckCircle2,
  Clock,
  MapPin,
  MessageSquareText,
  PhoneCall,
  PhoneMissed,
  PhoneOff,
  TrendingDown,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type PhoneScreen = "ringing" | "missed" | "stacking" | "lost" | "saved";

/**
 * Cadre de smartphone stylisé. `children` = contenu de l'écran.
 * Utilisé aussi bien dans l'histoire (problème) que dans la solution.
 */
export function PhoneFrame({
  children,
  className,
  glow,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  glow?: "amber" | "red" | "emerald" | "none";
  /** Permet de fixer une largeur via inline style (ex. `min()` non gérable par Tailwind). */
  style?: React.CSSProperties;
}) {
  const glowColor =
    glow === "red"
      ? "bg-red-500/20"
      : glow === "emerald"
        ? "bg-emerald-500/25"
        : "bg-amber-500/20";
  return (
    <div
      style={style}
      className={cn("relative mx-auto w-[280px] max-w-full", className)}
    >
      {glow && glow !== "none" && (
        <div
          aria-hidden
          className={cn("absolute -inset-8 -z-10 rounded-full blur-3xl", glowColor)}
        />
      )}
      <div className="relative rounded-[2.5rem] border border-white/10 bg-neutral-900 p-2.5 shadow-2xl shadow-black/60 ring-1 ring-white/5">
        {/* encoche */}
        <div className="absolute left-1/2 top-2.5 z-10 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-neutral-900" />
        <div className="relative aspect-[9/19] overflow-hidden rounded-[2rem] bg-neutral-950">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Écran de l'histoire (problème) qui change selon le beat actif. */
export function StoryScreen({ screen }: { screen: PhoneScreen }) {
  if (screen === "ringing") {
    return (
      <div className="flex h-full flex-col items-center justify-between bg-gradient-to-b from-neutral-900 to-neutral-950 px-6 py-14 text-center text-white">
        <div className="space-y-1 pt-4">
          <p className="text-sm text-white/50">Appel entrant</p>
          <p className="text-2xl font-semibold tracking-tight">Numéro inconnu</p>
          <p className="text-sm text-white/40">Mobile · Belgique</p>
        </div>
        <div className="relative">
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/30" />
          <span className="relative flex size-20 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/40">
            <PhoneCall className="size-8 text-emerald-400" />
          </span>
        </div>
        <p className="animate-pulse text-sm font-medium text-white/60">
          ça sonne dans le vide…
        </p>
      </div>
    );
  }

  if (screen === "missed") {
    return (
      <div className="flex h-full flex-col justify-center gap-4 bg-neutral-950 px-6 text-white">
        <div className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
          <PhoneMissed className="size-6 shrink-0 text-red-400" />
          <div>
            <p className="font-semibold">Appel manqué</p>
            <p className="text-sm text-white/50">Numéro inconnu · 15:02</p>
          </div>
        </div>
        <p className="px-1 text-sm text-white/40">
          Les mains dans le cambouis. Impossible de décrocher.
        </p>
      </div>
    );
  }

  if (screen === "stacking") {
    return (
      <div className="flex h-full flex-col justify-center gap-2.5 bg-neutral-950 px-5 text-white">
        {[
          { t: "15:02", n: "Numéro inconnu" },
          { t: "15:19", n: "Numéro inconnu" },
          { t: "16:44", n: "06 12 ·· ·· 90" },
          { t: "17:31", n: "Numéro inconnu" },
        ].map((c, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5"
          >
            <PhoneMissed className="size-4 shrink-0 text-red-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{c.n}</p>
              <p className="text-xs text-white/40">{c.t}</p>
            </div>
          </div>
        ))}
        <p className="pt-1 text-center text-sm font-semibold text-red-400">
          4 appels manqués aujourd&apos;hui
        </p>
      </div>
    );
  }

  if (screen === "lost") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 bg-gradient-to-b from-red-950/40 to-neutral-950 px-6 text-center text-white">
        <span className="flex size-16 items-center justify-center rounded-full bg-red-500/15 ring-1 ring-red-500/30">
          <PhoneOff className="size-7 text-red-400" />
        </span>
        <div>
          <p className="text-4xl font-bold tracking-tight text-red-400">−4</p>
          <p className="mt-1 text-sm text-white/50">
            clients partis chez le voisin
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-white/40">
          <TrendingDown className="size-3.5" />
          <span>et il ne le saura jamais</span>
        </div>
      </div>
    );
  }

  // saved — ce que fait Rappl
  return (
    <div className="flex h-full flex-col gap-3 bg-gradient-to-b from-emerald-950/40 to-neutral-950 px-4 py-10 text-white">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-400">
        <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/20">
          <CheckCircle2 className="size-3.5" />
        </span>
        Avec Rappl
      </div>

      {/* SMS envoyé au nom de l'artisan */}
      <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-white/[0.06] px-3 py-2 text-[13px] leading-snug text-white/90 ring-1 ring-white/10">
        Bonjour, ici Dupont Plomberie, désolé nous étions sur un chantier 👋
        Comment puis-je vous aider&nbsp;?
      </div>

      {/* Besoin qualifié */}
      <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center gap-2 text-[13px]">
          <MessageSquareText className="size-4 shrink-0 text-emerald-400" />
          <span>Fuite sous évier</span>
        </div>
        <div className="flex items-center gap-2 text-[13px]">
          <Clock className="size-4 shrink-0 text-emerald-400" />
          <span>Urgent — aujourd&apos;hui</span>
        </div>
        <div className="flex items-center gap-2 text-[13px]">
          <MapPin className="size-4 shrink-0 text-emerald-400" />
          <span>Tournai · dispo après 17 h</span>
        </div>
      </div>

      {/* Alerte au patron */}
      <div className="mt-auto flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2.5 text-sm font-medium text-emerald-300">
        <BellRing className="size-4 shrink-0" />
        Client rappelé. Chantier sauvé.
      </div>
    </div>
  );
}

/** Petit récap « le patron est prévenu » pour la partie solution. */
export function LeadAlertScreen() {
  return (
    <div className="flex h-full flex-col gap-3 bg-neutral-950 px-5 py-12 text-white">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-amber-400">
        <span className="flex size-2 rounded-full bg-amber-400" />
        Nouveau lead qualifié
      </div>
      <div className="space-y-2.5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <Row label="Client" value="Julie D." />
        <Row label="Besoin" value="Fuite sous évier" />
        <Row label="Urgence" value="Aujourd'hui" accent />
        <Row label="Lieu" value="Tournai" />
        <Row label="Dispo" value="Après 17 h" />
      </div>
      <div className="mt-auto flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2.5 text-sm text-amber-300">
        <Clock className="size-4 shrink-0" />
        Reçu 38 s après l&apos;appel manqué
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-white/40">{label}</span>
      <span
        className={cn(
          "font-medium",
          accent ? "text-amber-400" : "text-white/90",
        )}
      >
        {value}
      </span>
    </div>
  );
}
