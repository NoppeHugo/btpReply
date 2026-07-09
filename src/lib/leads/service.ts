import { db } from "@/lib/db";
import { LeadStatus, LeadUrgency } from "@/generated/prisma/client";
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
  // Lead partiel (conversation abandonnée) — voir schema.prisma. Appliqué à la
  // création uniquement pour ne pas écraser un lead qualifié existant.
  partial?: boolean;
  status?: LeadStatus;
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
      partial: params.partial ?? false,
      ...(params.status ? { status: params.status } : {}),
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
