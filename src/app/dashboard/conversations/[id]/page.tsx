import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import { ArrowLeft, Phone, MapPin, Clock } from "lucide-react";
import { ConversationReply } from "./ConversationReply";

const STATE_LABEL: Record<string, string> = {
  open: "En cours",
  qualified: "Qualifié",
  handed_off: "Transmis",
  closed: "Fermé",
};

const URGENCY_COLOR: Record<string, string> = {
  low: "text-white/50",
  medium: "text-amber-400",
  high: "text-red-400",
};

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;

  const conversation = await db.conversation.findUnique({
    where: { id },
    select: {
      id: true,
      clientId: true,
      callerNumber: true,
      state: true,
      language: true,
      autopilot: true,
      createdAt: true,
      lead: {
        select: {
          type: true,
          urgency: true,
          location: true,
          availability: true,
          summary: true,
          status: true,
        },
      },
      messages: {
        orderBy: { sentAt: "asc" },
        select: { id: true, direction: true, body: true, sentAt: true },
      },
    },
  });

  if (!conversation) notFound();

  if (
    session.user.role !== "admin" &&
    conversation.clientId !== session.user.clientId
  ) {
    redirect("/dashboard/calls");
  }

  const lead = conversation.lead;

  return (
    <div className="mx-auto max-w-2xl">
      {/* Back */}
      <Link
        href="/dashboard/calls"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white"
      >
        <ArrowLeft className="size-4" />
        Retour aux appels
      </Link>

      {/* Header */}
      <div className="mb-4 app-card">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-lg font-semibold text-white">
              {conversation.callerNumber}
            </p>
            <p className="text-xs text-white/40">
              {new Date(conversation.createdAt).toLocaleString("fr-BE", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
              {" · "}
              {conversation.language.toUpperCase()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`tel:${conversation.callerNumber}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
            >
              <Phone className="size-3.5" />
              Appeler
            </a>
            <span className="pill">
              {STATE_LABEL[conversation.state] ?? conversation.state}
            </span>
          </div>
        </div>

        {lead && (
          <div className="mt-3 border-t border-white/10 pt-3">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {lead.type && (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-white/70">
                  {lead.type}
                </span>
              )}
              {lead.urgency && (
                <span
                  className={`font-medium ${URGENCY_COLOR[lead.urgency] ?? ""}`}
                >
                  Urgence : {lead.urgency}
                </span>
              )}
              {lead.status && (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-300">
                  {lead.status}
                </span>
              )}
            </div>
            {lead.summary && (
              <p className="mt-2 text-sm text-white/80">{lead.summary}</p>
            )}
            {lead.location && (
              <p className="mt-1 flex items-center gap-1 text-xs text-white/50">
                <MapPin className="size-3 shrink-0" />
                {lead.location}
              </p>
            )}
            {lead.availability && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-white/50">
                <Clock className="size-3 shrink-0" />
                {lead.availability}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Chat */}
      <div className="space-y-2">
        {conversation.messages.length === 0 ? (
          <p className="text-center text-sm text-white/40">Aucun message.</p>
        ) : (
          conversation.messages.map((msg) => {
            const isOutbound = msg.direction === "outbound";
            return (
              <div
                key={msg.id}
                className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                    isOutbound
                      ? "rounded-br-sm bg-amber-500 text-neutral-950"
                      : "rounded-bl-sm bg-white/[0.06] text-white ring-1 ring-white/10"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.body}</p>
                  <p
                    className={`mt-1 text-right text-[10px] ${
                      isOutbound ? "text-neutral-950/60" : "text-white/40"
                    }`}
                  >
                    {new Date(msg.sentAt).toLocaleTimeString("fr-BE", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Réponse manuelle + bascule auto/manuel */}
      <ConversationReply
        conversationId={conversation.id}
        autopilot={conversation.autopilot}
      />
    </div>
  );
}
