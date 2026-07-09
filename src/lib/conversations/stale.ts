import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { upsertLead } from "@/lib/leads/service";
import {
  ConversationState,
  LeadStatus,
  MessageDirection,
} from "@/generated/prisma/client";

// Une conversation `open` sans nouveau message depuis ce délai est considérée
// abandonnée (le client a cessé de répondre).
const ABANDON_AFTER_HOURS = 24;
// Garde-fou : borne le lot traité par passage.
const MAX_PER_SWEEP = 200;

const SUMMARY_INCOMPLETE =
  "[A completer] Le client a commence a repondre puis n'a pas termine. A rappeler pour finaliser la demande.";

export interface SweepResult {
  scanned: number;
  closed: number;
  partialLeads: number;
}

/**
 * Balaye les conversations abandonnées (état `open`, autopilot actif, aucun
 * message depuis ABANDON_AFTER_HOURS) :
 *  - si le client avait commencé à répondre (≥ 1 message entrant), on crée un
 *    lead partiel `to_callback` pour ne pas perdre le contact (visible au récap) ;
 *  - dans tous les cas, on clôt la conversation (`closed`).
 *
 * Récupère le CA silencieusement perdu par les conversations qui ne se terminent
 * jamais. Idempotent : une conversation déjà `closed` n'est pas reprise.
 */
export async function sweepAbandonedConversations(
  now: Date = new Date()
): Promise<SweepResult> {
  const before = new Date(now.getTime() - ABANDON_AFTER_HOURS * 3600_000);

  const convs = await db.conversation.findMany({
    where: {
      state: ConversationState.open,
      autopilot: true,
      lastMessageAt: { lt: before },
    },
    orderBy: { lastMessageAt: "asc" },
    take: MAX_PER_SWEEP,
    select: { id: true, clientId: true, callerNumber: true },
  });

  let closed = 0;
  let partialLeads = 0;

  for (const conv of convs) {
    const inboundCount = await db.message.count({
      where: { conversationId: conv.id, direction: MessageDirection.inbound },
    });

    if (inboundCount > 0) {
      await upsertLead({
        clientId: conv.clientId,
        conversationId: conv.id,
        callerNumber: conv.callerNumber,
        type: null,
        urgency: null,
        location: null,
        availability: null,
        summary: SUMMARY_INCOMPLETE,
        partial: true,
        status: LeadStatus.to_callback,
      });
      partialLeads++;
    }

    await db.conversation.update({
      where: { id: conv.id },
      data: { state: ConversationState.closed },
    });
    closed++;
  }

  logger.info(
    { scanned: convs.length, closed, partialLeads },
    "Balayage conversations abandonnées terminé"
  );

  return { scanned: convs.length, closed, partialLeads };
}
