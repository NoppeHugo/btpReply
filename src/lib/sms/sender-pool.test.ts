import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    senderNumber: { findMany: vi.fn() },
    conversation: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn() } }));

import { assignSenderNumber, getSenderPool } from "./sender-pool";
import { db } from "@/lib/db";

const mockDb = db as unknown as {
  senderNumber: { findMany: ReturnType<typeof vi.fn> };
  conversation: { findMany: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.TWILIO_SENDERS;
  delete process.env.TWILIO_SENDER;
  mockDb.senderNumber.findMany.mockResolvedValue([]);
  mockDb.conversation.findMany.mockResolvedValue([]);
});

describe("getSenderPool", () => {
  it("privilégie la table SenderNumber", async () => {
    mockDb.senderNumber.findMany.mockResolvedValue([
      { number: "+321" },
      { number: "+322" },
    ]);
    process.env.TWILIO_SENDER = "+329"; // ignoré car la table n'est pas vide
    expect(await getSenderPool()).toEqual(["+321", "+322"]);
  });

  it("retombe sur TWILIO_SENDERS (séparés par virgules) si la table est vide", async () => {
    process.env.TWILIO_SENDERS = "+321, +322 ,+323";
    expect(await getSenderPool()).toEqual(["+321", "+322", "+323"]);
  });

  it("retombe sur TWILIO_SENDER unique si rien d'autre", async () => {
    process.env.TWILIO_SENDER = "+329";
    expect(await getSenderPool()).toEqual(["+329"]);
  });
});

describe("assignSenderNumber", () => {
  it("lève si aucun numéro disponible", async () => {
    await expect(assignSenderNumber("+32477000001")).rejects.toThrow();
  });

  it("renvoie l'unique numéro sans interroger les conversations (pool = 1)", async () => {
    process.env.TWILIO_SENDER = "+329";
    const chosen = await assignSenderNumber("+32477000001");
    expect(chosen).toBe("+329");
    expect(mockDb.conversation.findMany).not.toHaveBeenCalled();
  });

  it("choisit un numéro libre pour l'appelant quand un autre est occupé", async () => {
    mockDb.senderNumber.findMany.mockResolvedValue([
      { number: "+321" },
      { number: "+322" },
    ]);
    // L'appelant a déjà une conversation active sur +321 → on doit prendre +322.
    mockDb.conversation.findMany.mockResolvedValue([
      { senderNumber: "+321", lastMessageAt: new Date() },
    ]);

    expect(await assignSenderNumber("+32477000001")).toBe("+322");
  });

  it("repli : pool saturé → numéro le moins récemment actif avec cet appelant", async () => {
    mockDb.senderNumber.findMany.mockResolvedValue([
      { number: "+321" },
      { number: "+322" },
    ]);
    const older = new Date("2026-07-01T10:00:00Z");
    const newer = new Date("2026-07-04T10:00:00Z");
    mockDb.conversation.findMany.mockResolvedValue([
      { senderNumber: "+321", lastMessageAt: older },
      { senderNumber: "+322", lastMessageAt: newer },
    ]);

    // Les deux sont occupés → on réutilise le plus ancien (+321).
    expect(await assignSenderNumber("+32477000001")).toBe("+321");
  });
});
