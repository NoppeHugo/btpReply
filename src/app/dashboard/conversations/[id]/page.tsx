import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";

const STATE_LABEL: Record<string, string> = {
  open: "En cours",
  qualified: "Qualifié",
  handed_off: "Transmis",
  closed: "Fermé",
};

const URGENCY_COLOR: Record<string, string> = {
  low: "text-gray-500",
  medium: "text-orange-600",
  high: "text-red-600",
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
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
      >
        ← Retour aux appels
      </Link>

      {/* Header */}
      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-lg font-semibold text-gray-900">
              {conversation.callerNumber}
            </p>
            <p className="text-xs text-gray-400">
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
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
            {STATE_LABEL[conversation.state] ?? conversation.state}
          </span>
        </div>

        {lead && (
          <div className="mt-3 border-t border-gray-100 pt-3">
            <div className="flex flex-wrap gap-3 text-xs">
              {lead.type && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
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
                <span className="rounded-full bg-green-50 px-2 py-0.5 text-green-700">
                  {lead.status}
                </span>
              )}
            </div>
            {lead.summary && (
              <p className="mt-2 text-sm text-gray-700">{lead.summary}</p>
            )}
            {lead.location && (
              <p className="mt-1 text-xs text-gray-500">📍 {lead.location}</p>
            )}
            {lead.availability && (
              <p className="mt-0.5 text-xs text-gray-500">
                🕐 {lead.availability}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Chat */}
      <div className="space-y-2">
        {conversation.messages.length === 0 ? (
          <p className="text-center text-sm text-gray-400">Aucun message.</p>
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
                      ? "rounded-br-sm bg-blue-600 text-white"
                      : "rounded-bl-sm bg-white text-gray-900 shadow-sm ring-1 ring-gray-200"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.body}</p>
                  <p
                    className={`mt-1 text-right text-[10px] ${
                      isOutbound ? "text-blue-200" : "text-gray-400"
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
    </div>
  );
}
