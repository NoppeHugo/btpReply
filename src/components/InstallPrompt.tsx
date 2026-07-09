"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

// Invite à installer la PWA.
//  - Android/Chrome : capte beforeinstallprompt → bouton « Installer ».
//  - iOS/Safari : pas d'événement → instructions « Partager → Sur l'écran d'accueil ».
// Masqué si déjà installé (display-mode standalone).

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// État navigateur externe lu via useSyncExternalStore (pas de setState en effet,
// et snapshot serveur stable → pas de mismatch d'hydratation).
function useStandalone(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(display-mode: standalone)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    () => false
  );
}

function useIsIOS(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => /iphone|ipad|ipod/i.test(navigator.userAgent),
    () => false
  );
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [closed, setClosed] = useState(false);
  const standalone = useStandalone();
  const isIOS = useIsIOS();

  useEffect(() => {
    // setDeferred est appelé dans un callback d'événement (autorisé), pas
    // synchronement dans le corps de l'effet.
    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  // Rien à proposer : déjà installé, fermé, ou plateforme sans piste d'install.
  if (standalone || closed || (!deferred && !isIOS)) return null;

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    setDeferred(null);
    setClosed(true);
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl border border-white/10 bg-neutral-900 p-4 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white">Installer l&apos;app</p>
          {deferred ? (
            <p className="mt-1 text-xs text-white/60">
              Accédez à btpReply comme une vraie application.
            </p>
          ) : (
            <p className="mt-1 text-xs text-white/60">
              Appuyez sur Partager, puis «&nbsp;Sur l&apos;écran d&apos;accueil&nbsp;».
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setClosed(true)}
          className="text-white/40 hover:text-white/70"
          aria-label="Fermer"
        >
          ✕
        </button>
      </div>
      {deferred && (
        <button type="button" onClick={install} className="btn-primary mt-3 w-full">
          Installer
        </button>
      )}
    </div>
  );
}
