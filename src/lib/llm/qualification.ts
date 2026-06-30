import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, QUALIFICATION_MODEL } from "./client";
import { logger } from "@/lib/logger";

const MAX_USER_TURNS = 6;

// ── Types ──────────────────────────────────────────────────────────────────

export interface QualificationResult {
  reply: string;
  qualification: {
    type: string | null;
    urgency: "low" | "medium" | "high" | null;
    location: string | null;
    availability: string | null;
    summary: string;
  };
  complete: boolean;
  needs_human: boolean;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

// ── System prompt (cached) ─────────────────────────────────────────────────

function buildSystemPrompt(clientName: string, language: string): string {
  const langInstruction =
    language === "nl"
      ? "Le client s'exprime en néerlandais. Répondez INTÉGRALEMENT en néerlandais."
      : "Répondez en français, sauf si le client écrit en néerlandais, auquel cas répondez en néerlandais.";

  return `Vous êtes le bureau de ${clientName}. Votre rôle est de répondre aux clients qui ont rappelé suite à un appel manqué et de comprendre leur besoin pour le transmettre à l'équipe.

Comportement attendu :
- ${langInstruction}
- Répondez de manière professionnelle, chaleureuse et concise (SMS = court, ≤ 320 caractères)
- Cherchez à qualifier le besoin : type de travail demandé, urgence, lieu d'intervention, disponibilités du client
- La conversation débute par la réponse du client à votre SMS de prise de contact
- Maximum ${MAX_USER_TURNS} messages du client au total ; si ce seuil est atteint, transmettez et mettez needs_human à true
- Si le client semble frustré, insiste, ou dépasse votre domaine d'activité, mettez needs_human à true

Règles absolues (garde-fous) :
- Vous représentez de vraies personnes du bureau, jamais un programme ou un système
- Ne répondez jamais à des demandes sans rapport avec votre activité (spam, hors-sujet) — redirigez poliment et mettez needs_human à true
- Utilisez TOUJOURS l'outil qualify_conversation, ne produisez jamais de texte libre`;
}

// ── Tool definition (cached) ───────────────────────────────────────────────
// P3-T2 : contrat de sortie JSON strict via tool use

const QUALIFY_TOOL: Anthropic.Tool = {
  name: "qualify_conversation",
  description:
    "Répond au client par SMS et extrait les informations de qualification du besoin.",
  input_schema: {
    type: "object",
    properties: {
      reply: {
        type: "string",
        description:
          "Le SMS de réponse à envoyer au client. Ton naturel et humain, ≤ 320 caractères.",
      },
      qualification: {
        type: "object",
        properties: {
          type: {
            anyOf: [{ type: "string" }, { type: "null" }],
            description:
              "Type de travaux demandés (ex : plomberie, électricité, toiture). null si non déterminé.",
          },
          urgency: {
            anyOf: [
              { type: "string", enum: ["low", "medium", "high"] },
              { type: "null" },
            ],
            description:
              "Urgence : low (pas pressé), medium (dans la semaine), high (urgent / urgence). null si non déterminé.",
          },
          location: {
            anyOf: [{ type: "string" }, { type: "null" }],
            description: "Lieu d'intervention ou adresse. null si non précisé.",
          },
          availability: {
            anyOf: [{ type: "string" }, { type: "null" }],
            description:
              "Disponibilités du client pour l'intervention. null si non mentionnées.",
          },
          summary: {
            type: "string",
            description:
              "Résumé du besoin en 2-3 phrases pour le patron (qui rappellera).",
          },
        },
        required: ["type", "urgency", "location", "availability", "summary"],
      },
      complete: {
        type: "boolean",
        description:
          "true si on a suffisamment d'infos pour créer un lead qualifié (au minimum type + urgence + résumé).",
      },
      needs_human: {
        type: "boolean",
        description:
          "true si le patron doit intervenir directement (frustration, hors-sujet, max tours atteint).",
      },
    },
    required: ["reply", "qualification", "complete", "needs_human"],
  },
  cache_control: { type: "ephemeral" },
};

// ── Main entry point ───────────────────────────────────────────────────────

export async function qualifyMessage(params: {
  clientName: string;
  language?: string;
  messages: ConversationMessage[];
}): Promise<QualificationResult> {
  const userTurns = params.messages.filter((m) => m.role === "user").length;
  const forceHandoff = userTurns >= MAX_USER_TURNS;

  const response = await getAnthropicClient().messages.create({
    model: QUALIFICATION_MODEL,
    max_tokens: 400,
    system: [
      {
        type: "text",
        text: buildSystemPrompt(params.clientName, params.language ?? "fr"),
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [QUALIFY_TOOL],
    tool_choice: { type: "tool", name: "qualify_conversation" },
    messages: params.messages,
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("qualify_conversation: aucun appel d'outil retourné par le LLM");
  }

  const result = toolUse.input as QualificationResult;

  // P3-T5 : forcer le handoff si le plafond de tours est atteint
  if (forceHandoff) {
    result.needs_human = true;
  }

  const usage = response.usage as Anthropic.Usage & {
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };

  logger.info(
    {
      model: QUALIFICATION_MODEL,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheRead: usage.cache_read_input_tokens ?? 0,
      cacheWrite: usage.cache_creation_input_tokens ?? 0,
      userTurns,
      complete: result.complete,
      needs_human: result.needs_human,
    },
    "LLM qualification"
  );

  return result;
}
