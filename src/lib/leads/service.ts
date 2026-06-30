import { db } from "@/lib/db";
import { LeadUrgency } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";

interface UpsertLeadParams {
  clientId: string;
  conversationId: string;
  callerNumber: string;
  type: string | null;
  urgency: "low" | "medium" | "high" | null;
  location: string | null;
  availability: string | null;
  summary: string;
}

export async function upsertLead(params: UpsertLeadParams): Promise<string> {
  const urgencyMap: Record<"low" | "medium" | "high", LeadUrgency> = {
    low: LeadUrgency.low,
    medium: LeadUrgency.medium,
    high: LeadUrgency.high,
  };

  const lead = await db.lead.upsert({
    where: { conversationId: params.conversationId },
    create: {
      clientId: params.clientId,
      conversationId: params.conversationId,
      type: params.type,
      urgency: params.urgency ? urgencyMap[params.urgency] : null,
      location: params.location,
      availability: params.availability,
      summary: params.summary,
    },
    update: {
      type: params.type,
      urgency: params.urgency ? urgencyMap[params.urgency] : null,
      location: params.location,
      availability: params.availability,
      summary: params.summary,
    },
    select: { id: true },
  });

  logger.info(
    { leadId: lead.id, conversationId: params.conversationId, clientId: params.clientId },
    "Lead créé/mis à jour"
  );

  return lead.id;
}
