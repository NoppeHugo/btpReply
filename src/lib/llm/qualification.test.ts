import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/llm/client", () => ({
  getAnthropicClient: vi.fn(),
  QUALIFICATION_MODEL: "claude-haiku-4-5-20251001",
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { qualifyMessage } from "./qualification";
import { getAnthropicClient } from "@/lib/llm/client";

const mockCreate = vi.fn();
const mockGetClient = getAnthropicClient as ReturnType<typeof vi.fn>;

function makeToolUseResponse(input: object) {
  return {
    content: [{ type: "tool_use", name: "qualify_conversation", input }],
    usage: {
      input_tokens: 100,
      output_tokens: 50,
      cache_read_input_tokens: 80,
      cache_creation_input_tokens: 20,
    },
  };
}

const BASE_RESULT = {
  reply: "Merci, je transmets votre demande.",
  qualification: {
    type: "plomberie",
    urgency: "high",
    location: "Bruxelles",
    availability: "demain matin",
    summary: "Fuite d'eau urgente à Bruxelles.",
  },
  complete: true,
  needs_human: false,
};

const MESSAGES = [
  { role: "user" as const, content: "J'ai une fuite d'eau urgente" },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockGetClient.mockReturnValue({ messages: { create: mockCreate } });
});

describe("qualifyMessage", () => {
  it("retourne le résultat du LLM quand le tool use est correct", async () => {
    mockCreate.mockResolvedValue(makeToolUseResponse(BASE_RESULT));

    const result = await qualifyMessage({
      clientName: "Plomberie Martin",
      messages: MESSAGES,
    });

    expect(result.reply).toBe(BASE_RESULT.reply);
    expect(result.complete).toBe(true);
    expect(result.needs_human).toBe(false);
    expect(result.qualification.urgency).toBe("high");
  });

  it("passe tool_choice sur qualify_conversation", async () => {
    mockCreate.mockResolvedValue(makeToolUseResponse(BASE_RESULT));

    await qualifyMessage({ clientName: "Martin", messages: MESSAGES });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        tool_choice: { type: "tool", name: "qualify_conversation" },
      })
    );
  });

  it("force needs_human=true quand ≥ 6 messages user", async () => {
    mockCreate.mockResolvedValue(
      makeToolUseResponse({ ...BASE_RESULT, needs_human: false })
    );

    const manyMessages = Array.from({ length: 6 }, (_, i) => ({
      role: "user" as const,
      content: `Message ${i + 1}`,
    }));

    const result = await qualifyMessage({
      clientName: "Martin",
      messages: manyMessages,
    });

    expect(result.needs_human).toBe(true);
  });

  it("inclut cache_control sur le system prompt", async () => {
    mockCreate.mockResolvedValue(makeToolUseResponse(BASE_RESULT));

    await qualifyMessage({ clientName: "Martin", messages: MESSAGES });

    const call = mockCreate.mock.calls[0][0];
    expect(Array.isArray(call.system)).toBe(true);
    expect(call.system[0].cache_control).toEqual({ type: "ephemeral" });
  });

  it("lève une erreur si le LLM ne retourne pas de tool_use", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "réponse inattendue" }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    await expect(
      qualifyMessage({ clientName: "Martin", messages: MESSAGES })
    ).rejects.toThrow("qualify_conversation");
  });
});
