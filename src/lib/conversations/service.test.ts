import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    conversation: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    message: { create: vi.fn() },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}));

import {
  getOrCreateConversation,
  recordMessage,
  findOpenConversationByCallerNumber,
} from "./service";
import { db } from "@/lib/db";
import { MessageDirection } from "@/generated/prisma/client";

const mockDb = db as unknown as {
  conversation: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  message: { create: ReturnType<typeof vi.fn> };
};

beforeEach(() => vi.clearAllMocks());

describe("getOrCreateConversation", () => {
  it("retourne l'id existant si la conversation existe déjà", async () => {
    mockDb.conversation.findUnique.mockResolvedValue({ id: "conv-01" });

    const id = await getOrCreateConversation({
      clientId: "c1",
      callId: "call-01",
      callerNumber: "+32477000001",
    });

    expect(id).toBe("conv-01");
    expect(mockDb.conversation.create).not.toHaveBeenCalled();
  });

  it("crée une nouvelle conversation si elle n'existe pas", async () => {
    mockDb.conversation.findUnique.mockResolvedValue(null);
    mockDb.conversation.create.mockResolvedValue({ id: "conv-02" });

    const id = await getOrCreateConversation({
      clientId: "c1",
      callId: "call-02",
      callerNumber: "+32477000001",
    });

    expect(id).toBe("conv-02");
    expect(mockDb.conversation.create).toHaveBeenCalledOnce();
  });
});

describe("recordMessage", () => {
  it("crée le message et incrémente turnCount", async () => {
    mockDb.message.create.mockResolvedValue({ id: "msg-01" });
    mockDb.conversation.update.mockResolvedValue({});

    const id = await recordMessage({
      clientId: "c1",
      conversationId: "conv-01",
      direction: MessageDirection.inbound,
      body: "Bonjour",
    });

    expect(id).toBe("msg-01");
    expect(mockDb.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ turnCount: { increment: 1 } }),
      })
    );
  });
});

describe("findOpenConversationByCallerNumber", () => {
  it("retourne la conversation ouverte la plus récente", async () => {
    const expected = { id: "conv-01", callId: "call-01", turnCount: 2 };
    mockDb.conversation.findFirst.mockResolvedValue(expected);

    const result = await findOpenConversationByCallerNumber("c1", "+32477000001");
    expect(result).toEqual(expected);
  });

  it("retourne null si aucune conversation ouverte", async () => {
    mockDb.conversation.findFirst.mockResolvedValue(null);
    const result = await findOpenConversationByCallerNumber("c1", "+32477000002");
    expect(result).toBeNull();
  });
});
