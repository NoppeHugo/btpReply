import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock,
  Languages,
  MessageSquareText,
  PhoneMissed,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CountUp } from "@/components/landing/count-up";
import { LandingNav } from "@/components/landing/nav";
import { LeadAlertScreen, PhoneFrame } from "@/components/landing/phone";
import { Reveal } from "@/components/landing/reveal";
import { ScrollProgress } from "@/components/landing/scroll-progress";
import { SmsThread } from "@/components/landing/sms-thread";
import { StoryScrolly } from "@/components/landing/story-scrolly";

export const metadata: Metadata = {
  title: "Rappl — Ne perdez plus un seul chantier sur un appel manqué",
  description:
    "Vous êtes sur le chantier, le téléphone sonne dans le vide. Rappl répond par SMS en votre nom, qualifie le besoin et vous envoie un client prêt à être rappelé. Pour les artisans de l'Eurométropole.",
};

const STEPS = [
  {
    icon: PhoneMissed,
    label: "Appel manqué détecté",
    title: "Un appel bascule ? On le voit à la seconde.",
    body: "Dès qu'un appel n'aboutit pas — vous êtes sur un toit, en réunion, hors horaires — Rappl le repère instantanément. Aucun numéro ne tombe dans l'oubli.",
  },
  {
    icon: MessageSquareText,
    label: "SMS immédiat, en votre nom",
    title: "Un SMS part sous 30 s, au nom de votre entreprise.",
    body: "« Bonjour, ici le secrétariat de Dupont Plomberie, désolé nous étions sur un chantier… ». Chaleureux, humain, jamais un répondeur. Le client se sent pris en charge.",
  },
  {
    icon: ClipboardCheck,
    label: "Le besoin est qualifié",
    title: "On comprend la demande avant que vous rappeliez.",
    body: "Type de travaux, urgence, commune, disponibilité : la conversation cerne l'essentiel. Vous rappelez en connaissant déjà le chantier — plus de temps perdu.",
  },
  {
    icon: BellRing,
    label: "Vous êtes alerté",
    title: "Une alerte, puis le récap du soir.",
    body: "Chaque client qualifié déclenche une alerte immédiate. Le soir, un récap clair : qui a appelé, ce qu'ils veulent, qui reste à rappeler. Le ROI, noir sur blanc.",
  },
] as const;

const FEATURES = [
  {
    icon: Clock,
    title: "Répond en 30 secondes",
    body: "Le premier qui répond emporte le chantier. Ce sera vous, même les mains prises.",
  },
  {
    icon: UserRound,
    title: "En votre nom, jamais un robot",
    body: "Le ton d'un vrai secrétariat, avec le nom de votre boîte. Le client ne voit qu'un pro disponible.",
  },
  {
    icon: ClipboardCheck,
    title: "Besoin qualifié",
    body: "Type de travaux, urgence, lieu, disponibilité : l'info utile, prête quand vous rappelez.",
  },
  {
    icon: BellRing,
    title: "Alerte + récap quotidien",
    body: "Prévenu à chaque lead. Chaque soir, le bilan de la journée et le compteur du mois.",
  },
  {
    icon: ShieldCheck,
    title: "Horaires, liste blanche, STOP",
    body: "Vos règles : messages différents hors-heures, numéros exclus, opt-out respecté. Hébergé en Europe.",
  },
  {
    icon: Languages,
    title: "FR / NL",
    body: "Pensé pour l'Eurométropole Lille–Kortrijk–Tournai. Vos clients répondent dans leur langue.",
  },
] as const;

export default function Home() {
  return (
    <>
      <ScrollProgress />
      <LandingNav />

      <main className="flex-1 bg-neutral-950 text-white">
        {/* ============================ HERO ============================ */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 opacity-[0.15]"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.5) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
              maskImage:
                "radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent)",
              WebkitMaskImage:
                "radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent)",
            }}
          />
          <div
            aria-hidden
            className="absolute left-1/2 top-[-10%] -z-10 h-[500px] w-[900px] max-w-[95vw] -translate-x-1/2 animate-[pulse_7s_ease-in-out_infinite] rounded-full bg-amber-500/15 blur-[120px]"
          />
          <div
            aria-hidden
            className="absolute bottom-0 left-[10%] -z-10 h-[260px] w-[260px] animate-[pulse_9s_ease-in-out_infinite] rounded-full bg-red-500/10 blur-[100px]"
          />

          {/* Cartes flottantes : résument le drame d'un coup d'œil (xl+) */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 hidden xl:block"
          >
            <div className="absolute left-[4%] top-[34%] animate-[float_6s_ease-in-out_infinite]">
              <div className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-neutral-900/80 px-4 py-3 shadow-xl backdrop-blur">
                <PhoneMissed className="size-5 text-red-400" />
                <div className="text-left leading-tight">
                  <p className="text-sm font-semibold text-white">Appel manqué</p>
                  <p className="text-xs text-white/40">Numéro inconnu · 15:02</p>
                </div>
              </div>
            </div>
            <div className="absolute right-[4%] top-[30%] animate-[float_7s_ease-in-out_infinite_reverse]">
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-neutral-900/80 px-4 py-3 shadow-xl backdrop-blur">
                <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                  <MessageSquareText className="size-3" />
                </span>
                <div className="text-left leading-tight">
                  <p className="text-sm font-semibold text-white">SMS envoyé ✓</p>
                  <p className="text-xs text-white/40">en 28 secondes</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 pb-24 pt-32 text-center">
            <Reveal from="scale">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-medium text-white/70 sm:text-sm">
                <PhoneMissed className="size-3.5 text-amber-400" />
                Secrétariat SMS pour artisans du BTP · Eurométropole
              </span>
            </Reveal>

            <Reveal delay={80}>
              <h1 className="mt-7 text-balance text-[2.5rem] font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
                Chaque appel manqué est un chantier qui part{" "}
                <span className="relative inline-block text-amber-400">
                  chez le concurrent.
                  <span
                    aria-hidden
                    className="absolute inset-x-0 -bottom-1 -z-10 h-3 rounded-full bg-amber-500/25 blur-[2px]"
                  />
                </span>
              </h1>
            </Reveal>

            <Reveal delay={160}>
              <p className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-white/60">
                Rappl répond par SMS à votre place, en votre nom, qualifie le
                besoin et vous renvoie un client prêt à être rappelé — sans que
                vous quittiez votre chantier.
              </p>
            </Reveal>

            <Reveal delay={240}>
              <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
                <a
                  href="#demo"
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "h-11 rounded-full bg-amber-500 px-6 text-base text-neutral-950 hover:bg-amber-400",
                  )}
                >
                  Réserver une démo
                  <ArrowRight className="size-4" />
                </a>
                <a
                  href="#solution"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "h-11 rounded-full border-white/15 bg-transparent px-6 text-base text-white hover:bg-white/10 hover:text-white",
                  )}
                >
                  Voir comment ça marche
                </a>
              </div>
            </Reveal>

            <Reveal delay={300}>
              <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs text-white/60 sm:text-sm">
                <ShieldCheck className="size-4 shrink-0 text-amber-400" />
                1er mois remboursé si on ne vous rapporte aucun client — sans
                engagement.
              </p>
            </Reveal>

            <Reveal delay={360}>
              <dl className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/5 sm:grid-cols-3">
                {[
                  { n: "80 %", t: "des appels manqués ne laissent aucun message" },
                  { n: "< 30 s", t: "pour recontacter avant le concurrent" },
                  { n: "2 min", t: "de conversation pour qualifier un besoin" },
                ].map((s) => (
                  <div key={s.t} className="bg-neutral-950 px-6 py-5 text-left">
                    <dt className="text-2xl font-semibold text-amber-400">
                      {s.n}
                    </dt>
                    <dd className="mt-1 text-sm text-white/50">{s.t}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>

          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center text-white/30"
          >
            <ChevronDown className="size-6 animate-bounce" />
          </div>
        </section>

        {/* ========================= LE PROBLÈME ========================= */}
        <section id="probleme" className="relative border-t border-white/5 py-24">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <Reveal>
              <p className="font-mono text-sm uppercase tracking-widest text-amber-400/80">
                Le problème
              </p>
              <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-5xl">
                D&apos;abord, l&apos;histoire de Marc — un vendredi ordinaire.
              </h2>
              <p className="mx-auto mt-5 max-w-lg text-lg text-white/50">
                Vous allez la reconnaître. Elle se rejoue sur tous les chantiers,
                chaque semaine. Faites défiler.
              </p>
            </Reveal>
          </div>

          <div className="mt-8">
            <StoryScrolly />
          </div>

          {/* Punchline de bascule */}
          <div className="mx-auto max-w-3xl px-6 pt-10 text-center">
            <Reveal from="scale">
              <p className="text-balance text-2xl font-medium leading-snug text-white/80 sm:text-3xl">
                Ce n&apos;est pas un problème de talent.{" "}
                <span className="text-white">
                  C&apos;est un problème de disponibilité.
                </span>{" "}
                Et ça, ça se règle.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ========================= LA SOLUTION ========================= */}
        <section
          id="solution"
          className="rounded-t-[2.5rem] bg-neutral-50 text-neutral-900"
        >
          <div className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
            <div className="max-w-2xl">
              <Reveal>
                <p className="font-mono text-sm uppercase tracking-widest text-amber-600">
                  La solution
                </p>
                <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-5xl">
                  Vous ne pouvez pas décrocher. Nous, si — en votre nom.
                </h2>
                <p className="mt-5 text-lg text-neutral-500">
                  Rappl transforme un appel manqué en client qualifié, en
                  quatre temps. Vous ne touchez à rien : vous continuez le
                  chantier, le fil se déroule tout seul.
                </p>
              </Reveal>
            </div>

            {/* Étapes en timeline + démo SMS */}
            <div className="mt-16 grid gap-12 lg:grid-cols-2 lg:gap-16">
              {/* Timeline */}
              <div className="relative space-y-8 before:absolute before:left-[27px] before:top-3 before:h-[calc(100%-2rem)] before:w-px before:bg-neutral-200">
                {STEPS.map((step, i) => (
                  <Reveal key={step.label} from="left" delay={i * 80}>
                    <div className="relative flex gap-5">
                      <span className="relative z-10 flex size-14 shrink-0 items-center justify-center rounded-2xl border border-neutral-200 bg-white shadow-sm">
                        <step.icon className="size-6 text-amber-600" />
                        <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-neutral-900 text-[11px] font-semibold text-white">
                          {i + 1}
                        </span>
                      </span>
                      <div className="pt-1">
                        <p className="text-xs font-medium uppercase tracking-wide text-amber-600">
                          {step.label}
                        </p>
                        <h3 className="mt-1 text-lg font-semibold tracking-tight">
                          {step.title}
                        </h3>
                        <p className="mt-1.5 text-[15px] leading-relaxed text-neutral-500">
                          {step.body}
                        </p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>

              {/* Démo SMS (sticky) */}
              <div className="lg:sticky lg:top-24 lg:self-start">
                <Reveal from="right">
                  <p className="mb-3 text-sm font-medium text-neutral-400">
                    En vrai, ça ressemble à ça 👇
                  </p>
                  <SmsThread />
                </Reveal>
              </div>
            </div>

            {/* Bandeau « le patron est prévenu » */}
            <Reveal>
              <div className="mt-20 grid items-center gap-10 rounded-3xl border border-neutral-200 bg-white p-8 sm:p-12 lg:grid-cols-2">
                <div>
                  <p className="font-mono text-sm uppercase tracking-widest text-amber-600">
                    Pendant ce temps, sur votre téléphone
                  </p>
                  <h3 className="mt-3 text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
                    Vous recevez un client, pas une corvée.
                  </h3>
                  <p className="mt-4 text-neutral-500">
                    Le lead arrive déjà qualifié : nom, besoin, urgence, lieu,
                    disponibilité. Vous choisissez qui rappeler en priorité, sans
                    jouer aux devinettes ni rappeler un numéro dans le vide.
                  </p>
                  <ul className="mt-6 space-y-2.5 text-sm text-neutral-600">
                    {[
                      "Alerte instantanée dès qu'un besoin est cerné",
                      "Récap du soir : capté aujourd'hui, à rappeler, ROI du mois",
                      "Rien à installer, rien à taper : votre numéro actuel suffit",
                    ].map((t) => (
                      <li key={t} className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600">
                          <ArrowRight className="size-3" />
                        </span>
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex justify-center">
                  <PhoneFrame glow="amber" className="w-[240px]">
                    <LeadAlertScreen />
                  </PhoneFrame>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ========================= BÉNÉFICES ========================= */}
        <section className="bg-neutral-50 text-neutral-900">
          <div className="mx-auto max-w-6xl px-6 pb-24 sm:pb-32">
            <Reveal>
              <h2 className="max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                Tout ce qu&apos;un bon secrétariat ferait. Sans l&apos;embaucher.
              </h2>
            </Reveal>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f, i) => (
                <Reveal key={f.title} delay={(i % 3) * 80}>
                  <div className="group h-full rounded-2xl border border-neutral-200 bg-white p-6 transition-colors hover:border-amber-300">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-neutral-900 text-white transition-colors group-hover:bg-amber-500 group-hover:text-neutral-950">
                      <f.icon className="size-5" />
                    </span>
                    <h3 className="mt-4 font-semibold tracking-tight">
                      {f.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
                      {f.body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ============================ ROI ============================ */}
        <section
          id="roi"
          className="relative overflow-hidden rounded-t-[2.5rem] bg-neutral-950 py-24 sm:py-32"
        >
          <div
            aria-hidden
            className="absolute left-1/2 top-0 -z-10 h-[400px] w-[700px] max-w-[95vw] -translate-x-1/2 rounded-full bg-amber-500/10 blur-[120px]"
          />
          <div className="mx-auto max-w-4xl px-6 text-center">
            <Reveal>
              <p className="font-mono text-sm uppercase tracking-widest text-amber-400/80">
                Le calcul
              </p>
              <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-5xl">
                Faisons le compte, à la truelle.
              </h2>
            </Reveal>

            <div className="mt-14 grid gap-4 sm:grid-cols-3">
              {[
                { to: 5, prefix: "", suffix: "", t: "appels manqués par semaine" },
                { to: 4, prefix: "1 sur ", suffix: "", t: "aurait signé un chantier" },
                { to: 800, prefix: "", suffix: " €", t: "de panier moyen, à la louche" },
              ].map((c, i) => (
                <Reveal key={c.t} delay={i * 100}>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                    <p className="text-4xl font-bold tracking-tight text-white">
                      <CountUp
                        to={c.to}
                        prefix={c.prefix}
                        suffix={c.suffix}
                        durationMs={1400}
                      />
                    </p>
                    <p className="mt-2 text-sm text-white/50">{c.t}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal from="scale" delay={200}>
              <div className="mt-8 rounded-3xl border border-amber-500/20 bg-amber-500/[0.06] p-8 sm:p-12">
                <p className="text-sm uppercase tracking-widest text-amber-400/80">
                  Soit, chaque mois, à peu près
                </p>
                <p className="mt-3 text-5xl font-bold tracking-tight text-amber-400 sm:text-7xl">
                  <CountUp to={4000} prefix="≈ " suffix=" €" durationMs={2000} />
                </p>
                <p className="mx-auto mt-4 max-w-md text-white/60">
                  qui sonnent dans le vide et repartent chez le concurrent. Rappl
                  en récupère la plus grande partie — pour une fraction de ce
                  montant, et sans embaucher personne.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ========================= GARANTIE ========================= */}
        <section id="garantie" className="bg-neutral-950">
          <div className="mx-auto max-w-4xl px-6 pb-24 sm:pb-32">
            <Reveal from="scale">
              <div className="rounded-3xl border border-amber-500/20 bg-amber-500/[0.06] p-8 text-center sm:p-12">
                <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
                  <ShieldCheck className="size-7" />
                </span>
                <h2 className="mt-6 text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Le risque est pour nous, pas pour vous.
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-pretty text-white/60 sm:text-lg">
                  Vous payez dès le premier jour — mais si Rappl ne vous capte
                  aucun nouveau client le premier mois, on vous rembourse
                  intégralement. Pas de piège, pas d&apos;engagement.
                </p>
                <ul className="mx-auto mt-8 grid max-w-2xl gap-3 text-left sm:grid-cols-3">
                  {[
                    "Mise en place offerte",
                    "Sans engagement — résiliable à tout moment",
                    "Remboursé si zéro client capté le 1er mois",
                  ].map((t) => (
                    <li
                      key={t}
                      className="flex items-start gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/80"
                    >
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-amber-400" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ========================= CTA FINAL ========================= */}
        <section id="demo" className="border-t border-white/5 bg-neutral-950">
          <div className="mx-auto max-w-3xl px-6 py-28 text-center sm:py-36">
            <Reveal from="scale">
              <PhoneMissed className="mx-auto size-10 text-amber-400" />
              <h2 className="mt-6 text-balance text-3xl font-semibold tracking-tight sm:text-5xl">
                Le prochain appel manqué, c&apos;est dans combien de temps ?
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-lg text-white/60">
                Installez-le une fois, oubliez-le, et ne perdez plus jamais un
                client parce que vous étiez en train de travailler.
              </p>
              <p className="mx-auto mt-4 text-sm text-white/45">
                Démo en 15 min · mise en place offerte · 1er mois remboursé si
                aucun client capté.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <a
                  href="mailto:contact@rappl.eu?subject=Démo%20Rappl"
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "h-12 rounded-full bg-amber-500 px-7 text-base text-neutral-950 hover:bg-amber-400",
                  )}
                >
                  Réserver ma démo
                  <ArrowRight className="size-4" />
                </a>
                <Link
                  href="/login"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "h-12 rounded-full border-white/15 bg-transparent px-7 text-base text-white hover:bg-white/10 hover:text-white",
                  )}
                >
                  J&apos;ai déjà un compte
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ============================ FOOTER ============================ */}
        <footer className="border-t border-white/5 bg-neutral-950">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-white/40 sm:flex-row">
            <div className="flex items-center gap-2 text-white/70">
              <span className="flex size-6 items-center justify-center rounded-md bg-amber-500 text-neutral-950">
                <PhoneMissed className="size-3.5" />
              </span>
              <span className="font-semibold">Rappl</span>
            </div>
            <p>Fait pour les artisans de l&apos;Eurométropole. Hébergé en Europe.</p>
            <p>© {new Date().getFullYear()} Rappl</p>
          </div>
        </footer>
      </main>
    </>
  );
}
