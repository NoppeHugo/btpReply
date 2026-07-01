"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type Direction = "up" | "down" | "left" | "right" | "scale" | "none";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  /** Délai avant l'apparition, en ms. */
  delay?: number;
  /** Sens depuis lequel l'élément arrive. */
  from?: Direction;
  /** Si false, l'élément se re-cache quand il ressort du viewport. */
  once?: boolean;
};

const HIDDEN_TRANSFORM: Record<Direction, string> = {
  up: "translate-y-8",
  down: "-translate-y-8",
  left: "translate-x-10",
  right: "-translate-x-10",
  scale: "scale-95",
  none: "",
};

/**
 * Révèle son contenu quand il entre dans le viewport (IntersectionObserver).
 * Zéro dépendance : transitions Tailwind + observer natif. Respecte
 * prefers-reduced-motion via les utilitaires `motion-reduce`.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  from = "up",
  once = true,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      // Environnement sans observer : on révèle au prochain frame (pas de
      // setState synchrone dans l'effet).
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -12% 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [once]);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        "transition-all duration-700 ease-out will-change-[transform,opacity] motion-reduce:!translate-x-0 motion-reduce:!translate-y-0 motion-reduce:!scale-100 motion-reduce:!opacity-100 motion-reduce:transition-none",
        visible
          ? "translate-x-0 translate-y-0 scale-100 opacity-100 blur-0"
          : cn("opacity-0 blur-[2px]", HIDDEN_TRANSFORM[from]),
        className,
      )}
    >
      {children}
    </div>
  );
}
