import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    conversation: { findMany: vi.fn(), update: vi.fn() },
    message: { count: vi.fn() },
  },
}));
vi.mock("@/lib/leads/service", () => ({ upsertLead: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn() } }));

import { sweepAbandonedConversations } from "./stale";
import { db } from "@/lib/db";
import { upsertLead } from "@/lib/leads/service";

const mockDb = db as unknown as {
  conversation: { findMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  message: { count: ReturnType<typeof vi.fn> };
};
const mockUpsert = upsertLead as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.conversation.update.mockResolvedValue({});
  mockUpsert.mockResolvedValue("lead-1");
});

describe("sweepAbandonedConversations", () => {
  it("client ayant répondu → lead partiel to_callback + clôture", async () => {
    mockDb.conversation.findMany.mockResolvedValue([
      { id: "conv-1", clientId: "c1", callerNumber: "+32477000001" },
    ]);
    mockDb.message.count.mockResolvedValue(2); // 2 messages entrants

    const res = await sweepAbandonedConversations();

    expect(res).toEqual({ scanned: 1, closed: 1, partialLeads: 1 });
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: "conv-1", partial: true, status: "to_callback" })
    );
    expect(mockDb.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "conv-1" }, data: { state: "closed" } })
    );
  });

  it("client n'ayant jamais répondu → clôture seule, aucun lead", async () => {
    mockDb.conversation.findMany.mockResolvedValue([
      { id: "conv-2", clientId: "c1", callerNumber: "+32477000002" },
    ]);
    mockDb.message.count.mockResolvedValue(0);

    const res = await sweepAbandonedConversations();

    expect(res).toEqual({ scanned: 1, closed: 1, partialLeads: 0 });
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockDb.conversation.update).toHaveBeenCalledOnce();
  });

  it("aucune conversation abandonnée → no-op", async () => {
    mockDb.conversation.findMany.mockResolvedValue([]);
    const res = await sweepAbandonedConversations();
    expect(res).toEqual({ scanned: 0, closed: 0, partialLeads: 0 });
    expect(mockDb.conversation.update).not.toHaveBeenCalled();
  });
});
