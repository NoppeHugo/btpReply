"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { PhoneFrame, StoryScreen, type PhoneScreen } from "./phone";

type Beat = {
  screen: PhoneScreen;
  time: string;
  title: string;
  body: string;
};

const BEATS: Beat[] = [
  {
    screen: "ringing",
    time: "15 h 02",
    title: "Marc a les deux mains dans une chaudière.",
    body: "Son téléphone sonne au fond de la sacoche. Un nouveau client, une fuite qui part en catastrophe. Impossible de tout lâcher maintenant.",
  },
  {
    screen: "missed",
    time: "15 h 02",
    title: "L'appel bascule sur la messagerie. Aucun message.",
    body: "Comme 8 personnes sur 10. Un répondeur, pour un client pressé, c'est une porte fermée. Il raccroche et passe au suivant sur sa liste.",
  },
  {
    screen: "stacking",
    time: "17 h 30",
    title: "Le soir : quatre appels manqués, zéro rappel.",
    body: "Marc voit les numéros inconnus s'empiler. Mais rappeler à 20 h, épuisé, sans savoir qui c'était ni ce qu'ils voulaient… il ne le fera pas.",
  },
  {
    screen: "lost",
    time: "le lendemain",
    title: "Déjà chez le concurrent qui a décroché.",
    body: "Marc ne perd pas des appels. Il perd des chantiers — sans jamais savoir combien. Un devis salle de bain manqué, c'est parfois 6 000 € envolés.",
  },
  {
    screen: "saved",
    time: "avec Rappl",
    title: "Sauf que cette fois, quelqu'un a répondu.",
    body: "Rappl envoie un SMS au nom de Marc, cerne le besoin (fuite, urgent, Tournai) et le prévient. Le client est rappelé le soir même — le chantier est sauvé.",
  },
];

function glowFor(screen: PhoneScreen) {
  if (screen === "lost") return "red" as const;
  if (screen === "saved") return "emerald" as const;
  return "amber" as const;
}

/**
 * Scrollytelling responsive.
 *  - **Mobile** : un grand téléphone centré, seul à l'écran. Tout le message
 *    (texte + icônes) vit DANS le téléphone ; les écrans changent au scroll.
 *    Les blocs de texte sont masqués et ne servent que d'espaceurs de défilement.
 *  - **Desktop** : téléphone centré + textes en alternance gauche / droite.
 */
export function StoryScrolly() {
  const [active, setActive] = useState(0);
  const beatRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number(
              (entry.target as HTMLElement).dataset.index ?? 0,
            );
            setActive(idx);
          }
        }
      },
      // Ligne de visée au centre du viewport : le beat qui la croise devient actif.
      { rootMargin: "-50% 0px -50% 0px", threshold: 0 },
    );

    for (const el of beatRefs.current) {
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const screen = BEATS[active].screen;
  const glow = glowFor(screen);

  return (
    <div className="relative mx-auto max-w-6xl px-6">
      {/* ---------- Espaceurs de scroll + textes (desktop) ---------- */}
      <div>
        {BEATS.map((beat, i) => {
          const onLeft = i % 2 === 0;
          return (
            <div
              key={i}
              ref={(el) => {
                beatRefs.current[i] = el;
              }}
              data-index={i}
              className={cn(
                // Mobile : hauteur du bloc = distance de scroll pour changer d'écran.
                // Augmenter cette valeur pour exiger encore plus de scroll.
                "flex min-h-[150svh] items-center lg:min-h-screen",
                onLeft ? "lg:justify-start" : "lg:justify-end",
              )}
            >
              {/* Texte : masqué sur mobile, visible sur desktop */}
              <div
                className={cn(
                  "hidden w-full lg:block lg:max-w-[19rem] xl:max-w-[22rem]",
                  !onLeft && "lg:text-right",
                )}
              >
                <span
                  className={cn(
                    "mb-4 inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 font-mono text-xs uppercase tracking-wider",
                    beat.screen === "lost"
                      ? "border-red-500/30 bg-red-500/10 text-red-400"
                      : beat.screen === "saved"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                        : "border-white/10 bg-white/[0.03] text-white/50",
                  )}
                >
                  <span className="flex size-1.5 rounded-full bg-current" />
                  {beat.time}
                </span>
                <h3 className="text-balance text-2xl font-semibold leading-snug tracking-tight text-white sm:text-3xl lg:text-[2rem]">
                  {beat.title}
                </h3>
                <p
                  className={cn(
                    "mt-4 text-base leading-relaxed text-white/50 sm:text-lg",
                    !onLeft && "lg:ml-auto",
                  )}
                >
                  {beat.body}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ---------- Téléphone épinglé — MOBILE (grand, centré) ---------- */}
      <div className="pointer-events-none absolute inset-0 lg:hidden">
        <div className="sticky top-0 flex h-[100svh] flex-col items-center justify-center gap-5 py-10">
          {/* Taille bornée par la largeur ET la hauteur visible pour ne jamais déborder.
              Largeur en inline style : Tailwind ne génère pas les `min()` avec virgule. */}
          <PhoneFrame
            className="transition-all duration-500"
            style={{ width: "min(78vw, 36svh)" }}
            glow={glow}
          >
            <PhoneScreenSwitch active={active} />
          </PhoneFrame>
          <Dots active={active} screen={screen} />
        </div>
      </div>

      {/* ---------- Téléphone épinglé — DESKTOP (centré) ---------- */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 top-0 hidden lg:block"
      >
        <div className="sticky top-0 flex h-screen flex-col items-center justify-center gap-6">
          <PhoneFrame
            className="w-[270px] transition-all duration-500"
            glow={glow}
          >
            <PhoneScreenSwitch active={active} />
          </PhoneFrame>
          <Dots active={active} screen={screen} />
        </div>
      </div>
    </div>
  );
}

/** Écran du téléphone avec animation d'entrée re-déclenchée à chaque beat. */
function PhoneScreenSwitch({ active }: { active: number }) {
  return (
    <div
      key={active}
      className="h-full animate-in fade-in slide-in-from-bottom-3 duration-500 ease-out"
    >
      <StoryScreen screen={BEATS[active].screen} />
    </div>
  );
}

/** Points de progression de l'histoire. */
function Dots({ active, screen }: { active: number; screen: PhoneScreen }) {
  const activeColor =
    screen === "lost"
      ? "bg-red-400"
      : screen === "saved"
        ? "bg-emerald-400"
        : "bg-amber-400";
  return (
    <div className="flex items-center gap-2">
      {BEATS.map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-all duration-500",
            i === active ? cn("w-6", activeColor) : "w-1.5 bg-white/20",
          )}
        />
      ))}
    </div>
  );
}
