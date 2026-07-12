"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  PhoneMissed,
  PhoneForwarded,
  PhoneCall,
  Lock,
  Clock,
  Users,
  Bell,
  Check,
  Copy,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { BusinessHoursSection } from "@/components/config/BusinessHoursSection";
import { SettingsSection } from "@/components/config/SettingsSection";
import { ContactImport } from "@/components/ContactImport";
import { EnablePushButton } from "@/components/EnablePushButton";
import { useStandalone, useIsIOS } from "@/components/InstallPrompt";
import { unwrap } from "@/lib/api/unwrap";

// Wizard de premier login de l'artisan. Chaque étape est sautable ; la
// progression est persistée (reprise où on s'est arrêté). « Terminer » marque
// l'onboarding complet et débloque le dashboard.

const STEPS = [
  { key: "password", label: "Mot de passe", icon: Lock },
  { key: "forwarding", label: "Renvoi d'appel", icon: PhoneForwarded },
  { key: "test-call", label: "Appel de test", icon: PhoneCall },
  { key: "hours", label: "Horaires", icon: Clock },
  { key: "contacts", label: "Contacts", icon: Users },
  { key: "alerts", label: "Alertes", icon: Bell },
  { key: "finish", label: "C'est parti", icon: Check },
] as const;

async function saveProgress(patch: { step?: number; completed?: boolean }) {
  await fetch("/api/v1/onboarding", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  }).catch(() => {});
}

export function OnboardingWizard({
  clientName,
  initialStep,
  phoneNumber,
}: {
  clientName: string;
  initialStep: number;
  phoneNumber: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(
    Math.min(Math.max(initialStep, 0), STEPS.length - 1)
  );
  const [finishing, setFinishing] = useState(false);

  function goTo(next: number) {
    const clamped = Math.min(Math.max(next, 0), STEPS.length - 1);
    setStep(clamped);
    saveProgress({ step: clamped });
    window.scrollTo({ top: 0 });
  }

  async function finish() {
    setFinishing(true);
    await saveProgress({ completed: true });
    router.push("/dashboard");
  }

  const current = STEPS[step];

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-neutral-950/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
          <span className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500 text-neutral-950">
              <PhoneMissed className="size-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight text-white">
              Rappl
            </span>
          </span>
          <button
            type="button"
            onClick={finish}
            disabled={finishing}
            className="text-xs text-white/40 transition-colors hover:text-white/70"
          >
            Configurer plus tard
          </button>
        </div>
        {/* Barre de progression */}
        <div className="h-0.5 w-full bg-white/5">
          <div
            className="h-full bg-amber-500 transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-6">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-amber-400">
          Étape {step + 1} / {STEPS.length} — {current.label}
        </p>

        {current.key === "password" && (
          <PasswordStep
            clientName={clientName}
            onNext={() => goTo(step + 1)}
          />
        )}
        {current.key === "forwarding" && (
          <ForwardingStep
            phoneNumber={phoneNumber}
            onNext={() => goTo(step + 1)}
            onBack={() => goTo(step - 1)}
          />
        )}
        {current.key === "test-call" && (
          <TestCallStep
            phoneNumber={phoneNumber}
            onNext={() => goTo(step + 1)}
            onBack={() => goTo(step - 1)}
          />
        )}
        {current.key === "hours" && (
          <SectionStep
            title="Vos heures d'ouverture"
            intro="En dehors de ces heures, vos clients reçoivent un SMS adapté (« nos bureaux sont fermés, on vous recontacte vite »)."
            onNext={() => goTo(step + 1)}
            onBack={() => goTo(step - 1)}
          >
            <BusinessHoursSection />
          </SectionStep>
        )}
        {current.key === "contacts" && (
          <SectionStep
            title="Protégez vos contacts"
            intro="Les personnes que vous connaissez déjà (famille, fournisseurs, collègues) ne recevront jamais de SMS automatique."
            onNext={() => goTo(step + 1)}
            onBack={() => goTo(step - 1)}
          >
            <ContactImport />
          </SectionStep>
        )}
        {current.key === "alerts" && (
          <SectionStep
            title="Comment vous prévenir ?"
            intro="À chaque nouveau client qualifié, vous recevez une alerte. Vérifiez que ces réglages vous conviennent."
            onNext={() => goTo(step + 1)}
            onBack={() => goTo(step - 1)}
          >
            <SettingsSection />
          </SectionStep>
        )}
        {current.key === "finish" && (
          <FinishStep
            finishing={finishing}
            onFinish={finish}
            onBack={() => goTo(step - 1)}
          />
        )}
      </main>
    </div>
  );
}

// ── Navigation commune ────────────────────────────────────────────────────────

function StepNav({
  onNext,
  onBack,
  nextLabel = "Continuer",
  nextDisabled = false,
}: {
  onNext: () => void;
  onBack?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  return (
    <div className="mt-6 flex items-center gap-3">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="btn-ghost border border-white/10"
        >
          Retour
        </button>
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className="btn-primary flex-1"
      >
        {nextLabel} <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

// ── Étape 1 : mot de passe ────────────────────────────────────────────────────

function PasswordStep({
  clientName,
  onNext,
}: {
  clientName: string;
  onNext: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/v1/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Échec du changement de mot de passe.");
        return;
      }
      setDone(true);
      setTimeout(onNext, 800);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-white">
        Bienvenue, {clientName}
      </h1>
      <p className="mt-2 text-sm text-white/60">
        En quelques minutes, votre secrétariat SMS sera opérationnel : plus
        aucun appel manqué ne restera sans réponse. Commençons par sécuriser
        votre compte.
      </p>

      <form onSubmit={submit} className="app-card mt-6 space-y-4">
        <div>
          <label className="app-label">Mot de passe actuel (provisoire)</label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="app-input w-full"
            placeholder="••••••••"
          />
        </div>
        <div>
          <label className="app-label">Nouveau mot de passe (8 min.)</label>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className="app-input w-full"
            placeholder="••••••••"
          />
        </div>
        <div>
          <label className="app-label">Confirmez le nouveau mot de passe</label>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="app-input w-full"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <button type="submit" disabled={saving || done} className="btn-primary w-full">
          {done ? (
            <>
              <Check className="size-4" /> Mot de passe changé
            </>
          ) : saving ? (
            "Enregistrement…"
          ) : (
            "Changer mon mot de passe"
          )}
        </button>
      </form>

      <p className="mt-4 text-center">
        <button
          type="button"
          onClick={onNext}
          className="text-xs text-white/40 hover:text-white/70"
        >
          Mon mot de passe est déjà personnel — passer
        </button>
      </p>
    </div>
  );
}

// ── Étape 2 : renvoi d'appel ──────────────────────────────────────────────────

function ForwardingStep({
  phoneNumber,
  onNext,
  onBack,
}: {
  phoneNumber: string | null;
  onNext: () => void;
  onBack: () => void;
}) {
  const [copied, setCopied] = useState<"number" | "code" | null>(null);
  // **004* active les TROIS renvois conditionnels d'un coup (pas de réponse,
  // occupé, injoignable) — **61* seul laisse passer les appels quand l'artisan
  // est déjà en ligne ou hors réseau (cave, chantier).
  const ussd = phoneNumber ? `**004*${phoneNumber}#` : null;

  async function copy(text: string, what: "number" | "code") {
    await navigator.clipboard.writeText(text);
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-white">
        Activez le renvoi d&apos;appel
      </h1>
      <p className="mt-2 text-sm text-white/60">
        C&apos;est l&apos;étape la plus importante : quand vous ne décrochez
        pas, l&apos;appel est renvoyé vers votre numéro Rappl, qui prend le
        relais par SMS. Vos appels décrochés ne changent pas.
      </p>

      {phoneNumber ? (
        <>
          <div className="app-card mt-6">
            <p className="text-xs text-white/50">Votre numéro Rappl</p>
            <div className="mt-1 flex items-center justify-between gap-3">
              <p className="font-mono text-lg font-semibold text-white">
                {phoneNumber}
              </p>
              <button
                type="button"
                onClick={() => copy(phoneNumber, "number")}
                className="btn-ghost border border-white/10"
              >
                {copied === "number" ? (
                  <>
                    <Check className="size-4" /> Copié
                  </>
                ) : (
                  <>
                    <Copy className="size-4" /> Copier
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="app-card mt-4">
            <p className="mb-2 text-sm font-medium text-white">
              Le plus simple : composez ce code
            </p>
            <p className="mb-3 text-xs text-white/50">
              Ouvrez votre clavier téléphonique, collez ce code et appuyez sur
              Appeler. Le renvoi est activé immédiatement pour les trois cas —
              pas de réponse, ligne occupée, hors réseau — chez tous les
              opérateurs.
            </p>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
              <code className="font-mono text-base font-semibold text-amber-300">
                {ussd}
              </code>
              <button
                type="button"
                onClick={() => ussd && copy(ussd, "code")}
                className="btn-primary shrink-0"
              >
                {copied === "code" ? (
                  <>
                    <Check className="size-4" /> Copié
                  </>
                ) : (
                  <>
                    <Copy className="size-4" /> Copier
                  </>
                )}
              </button>
            </div>
          </div>

          <details className="app-card mt-4">
            <summary className="cursor-pointer text-sm font-medium text-white/70">
              Ou via les réglages du téléphone
            </summary>
            <div className="mt-3 space-y-3 text-sm text-white/60">
              <p>
                <span className="font-medium text-white">iPhone :</span>{" "}
                Réglages → Apps → Téléphone → Renvoi d&apos;appel → Si pas de
                réponse → entrez {phoneNumber}
              </p>
              <p>
                <span className="font-medium text-white">Android :</span>{" "}
                Téléphone → ⋮ → Paramètres → Renvoi d&apos;appel → Si pas de
                réponse → entrez {phoneNumber}
              </p>
              <p className="text-xs text-white/40">
                Via les réglages, activez aussi « Si occupé » et « Si
                injoignable » vers le même numéro. Pour tout désactiver plus
                tard : composez ##004#
              </p>
            </div>
          </details>
        </>
      ) : (
        <div className="app-card mt-6 border-amber-500/30 bg-amber-500/10">
          <p className="text-sm text-amber-300">
            Votre numéro Rappl n&apos;est pas encore attribué. Nous vous
            l&apos;enverrons très vite — vous pouvez continuer la configuration
            en attendant.
          </p>
        </div>
      )}

      <StepNav onNext={onNext} onBack={onBack} nextLabel="C'est fait" />
    </div>
  );
}

// ── Étape 3 : appel de test ───────────────────────────────────────────────────

type CallRow = { id: string; calledAt: string };

function TestCallStep({
  phoneNumber,
  onNext,
  onBack,
}: {
  phoneNumber: string | null;
  onNext: () => void;
  onBack: () => void;
}) {
  const [detected, setDetected] = useState(false);
  // Seuls les appels reçus APRÈS l'arrivée sur cette étape comptent.
  const [since] = useState(() => Date.now());

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/calls?limit=1");
      if (!res.ok) return;
      const data = unwrap<{ calls: CallRow[] }>(await res.json());
      const latest = data?.calls?.[0];
      if (latest && new Date(latest.calledAt).getTime() >= since) {
        setDetected(true);
      }
    } catch {
      // réseau instable pendant l'appel : on retentera au tick suivant
    }
  }, [since]);

  useEffect(() => {
    if (detected) return;
    const id = setInterval(poll, 4000);
    return () => clearInterval(id);
  }, [poll, detected]);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-white">
        Faites le test
      </h1>
      <p className="mt-2 text-sm text-white/60">
        Depuis un autre téléphone (ou celui d&apos;un proche), appelez votre
        numéro professionnel habituel et <strong className="text-white">ne décrochez pas</strong>.
        Quelques secondes plus tard, l&apos;appelant reçoit votre SMS de
        secrétariat.
      </p>

      <div className="app-card mt-6 text-center">
        {detected ? (
          <>
            <div className="mb-3 flex justify-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                <Check className="size-6" />
              </span>
            </div>
            <p className="font-semibold text-emerald-400">
              Appel capté — ça marche !
            </p>
            <p className="mt-1 text-sm text-white/60">
              Le SMS est en route vers l&apos;appelant. Vous retrouverez chaque
              appel manqué dans l&apos;onglet Appels.
            </p>
          </>
        ) : (
          <>
            <div className="mb-3 flex justify-center">
              <Loader2 className="size-8 animate-spin text-amber-400" />
            </div>
            <p className="font-medium text-white">
              En attente de votre appel de test…
            </p>
            <p className="mt-1 text-sm text-white/50">
              Appelez votre numéro habituel et laissez sonner sans décrocher.
            </p>
            {phoneNumber && (
              <p className="mt-3 text-xs text-white/40">
                Astuce : vous pouvez aussi appeler directement votre numéro
                Rappl ({phoneNumber}) pour tester sans attendre la sonnerie.
              </p>
            )}
          </>
        )}
      </div>

      <StepNav
        onNext={onNext}
        onBack={onBack}
        nextLabel={detected ? "Continuer" : "Passer pour l'instant"}
      />
    </div>
  );
}

// ── Étapes 4-6 : sections réutilisées ────────────────────────────────────────

function SectionStep({
  title,
  intro,
  children,
  onNext,
  onBack,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-white">
        {title}
      </h1>
      <p className="mb-6 mt-2 text-sm text-white/60">{intro}</p>
      {children}
      <StepNav onNext={onNext} onBack={onBack} />
    </div>
  );
}

// ── Étape 7 : notifications + installation ───────────────────────────────────

function FinishStep({
  finishing,
  onFinish,
  onBack,
}: {
  finishing: boolean;
  onFinish: () => void;
  onBack: () => void;
}) {
  const standalone = useStandalone();
  const isIOS = useIsIOS();

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-white">
        Dernière ligne droite
      </h1>
      <p className="mt-2 text-sm text-white/60">
        Activez les notifications pour être prévenu à la seconde où un client
        qualifié arrive — même app fermée.
      </p>

      <div className="app-card mt-6">
        <p className="mb-3 text-sm font-medium text-white">Notifications</p>
        <EnablePushButton />
      </div>

      {!standalone && (
        <div className="app-card mt-4">
          <p className="mb-2 text-sm font-medium text-white">
            Installez l&apos;app sur votre écran d&apos;accueil
          </p>
          <p className="text-sm text-white/60">
            {isIOS
              ? "Appuyez sur Partager (carré avec flèche) puis « Sur l'écran d'accueil »."
              : "Dans le menu de votre navigateur, choisissez « Installer l'application » (ou « Ajouter à l'écran d'accueil »)."}
          </p>
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="btn-ghost border border-white/10"
        >
          Retour
        </button>
        <button
          type="button"
          onClick={onFinish}
          disabled={finishing}
          className="btn-primary flex-1"
        >
          {finishing ? "Ouverture…" : "Ouvrir mon tableau de bord"}
        </button>
      </div>
    </div>
  );
}
