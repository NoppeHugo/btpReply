import { cn } from "@/lib/utils";

type Bubble = {
  from: "pro" | "client";
  text: string;
  time: string;
};

/**
 * Reconstitution d'un échange SMS réel : le secrétariat répond au nom de
 * l'artisan et qualifie le besoin. Aucun vocabulaire « IA / robot », le fil
 * doit ressembler à un humain (cf. agents.md §1).
 */
const THREAD: Bubble[] = [
  {
    from: "pro",
    text:
      "Bonjour, ici le secrétariat de Dupont Plomberie 👋 Désolé, nous étions sur un chantier. Comment pouvons-nous vous aider ?",
    time: "15:02",
  },
  {
    from: "client",
    text: "Bonjour, j'ai une fuite sous mon évier, ça coule pas mal",
    time: "15:04",
  },
  {
    from: "pro",
    text: "Compris. C'est urgent pour aujourd'hui ou ça peut attendre cette semaine ?",
    time: "15:04",
  },
  { from: "client", text: "Aujourd'hui si possible, ça déborde", time: "15:05" },
  {
    from: "pro",
    text: "Très bien. Vous êtes sur quelle commune, et joignable à partir de quelle heure ?",
    time: "15:05",
  },
  { from: "client", text: "Tournai, dispo après 17h", time: "15:06" },
  {
    from: "pro",
    text:
      "Parfait, je transmets tout de suite à M. Dupont, il vous rappelle avant 17 h pour caler le passage. Bonne journée 🙏",
    time: "15:06",
  },
];

export function SmsThread({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-3xl border border-black/5 bg-neutral-50 p-4 shadow-sm sm:p-5",
        className,
      )}
    >
      <div className="mb-1 flex items-center justify-between border-b border-black/5 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white">
            JD
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Julie D.</p>
            <p className="text-xs text-emerald-600">SMS · en direct</p>
          </div>
        </div>
        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
          répond en 30 s
        </span>
      </div>

      {THREAD.map((b, i) => (
        <div
          key={i}
          className={cn(
            "flex flex-col",
            b.from === "pro" ? "items-start" : "items-end",
          )}
        >
          <div
            className={cn(
              "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-snug",
              b.from === "pro"
                ? "rounded-bl-sm bg-white text-neutral-800 shadow-sm ring-1 ring-black/5"
                : "rounded-br-sm bg-neutral-900 text-white",
            )}
          >
            {b.text}
          </div>
          <span className="mt-1 px-1 text-[10px] text-neutral-400">{b.time}</span>
        </div>
      ))}
    </div>
  );
}
