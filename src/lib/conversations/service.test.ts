import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    conversation: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    call: { findUnique: vi.fn() },
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
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  call: { findUnique: ReturnType<typeof vi.fn> };
  message: { create: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
  // senderNumber = numéro Twilio du client (celui qui a reçu l'appel).
  mockDb.call.findUnique.mockResolvedValue({ phoneNumber: { number: "+320000" } });
});

describe("getOrCreateConversation", () => {
  it("retourne l'id + senderNumber existants si la conversation existe déjà", async () => {
    mockDb.conversation.findUnique.mockResolvedValue({
      id: "conv-01",
      senderNumber: "+320000",
    });

    const result = await getOrCreateConversation({
      clientId: "c1",
      callId: "call-01",
      callerNumber: "+32477000001",
    });

    expect(result).toEqual({ id: "conv-01", senderNumber: "+320000" });
    expect(mockDb.conversation.create).not.toHaveBeenCalled();
  });

  it("crée une nouvelle conversation avec un numéro expéditeur assigné", async () => {
    mockDb.conversation.findUnique.mockResolvedValue(null);
    mockDb.conversation.create.mockResolvedValue({ id: "conv-02" });

    const result = await getOrCreateConversation({
      clientId: "c1",
      callId: "call-02",
      callerNumber: "+32477000001",
    });

    expect(result).toEqual({ id: "conv-02", senderNumber: "+320000" });
    expect(mockDb.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ senderNumber: "+320000" }),
      })
    );
  });

  it("rattrape et stocke un numéro expéditeur pour une conversation ancienne sans senderNumber", async () => {
    mockDb.conversation.findUnique.mockResolvedValue({
      id: "conv-03",
      senderNumber: null,
    });
    mockDb.conversation.update.mockResolvedValue({});

    const result = await getOrCreateConversation({
      clientId: "c1",
      callId: "call-03",
      callerNumber: "+32477000001",
    });

    expect(result).toEqual({ id: "conv-03", senderNumber: "+320000" });
    expect(mockDb.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "conv-03" },
        data: { senderNumber: "+320000" },
      })
    );
    expect(mockDb.conversation.create).not.toHaveBeenCalled();
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
