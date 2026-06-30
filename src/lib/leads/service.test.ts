import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    lead: { upsert: vi.fn() },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/generated/prisma/client", () => ({
  LeadUrgency: { low: "low", medium: "medium", high: "high" },
}));

import { upsertLead } from "./service";
import { db } from "@/lib/db";

const mockDb = db as unknown as { lead: { upsert: ReturnType<typeof vi.fn> } };

const BASE_PARAMS = {
  clientId: "client-01",
  conversationId: "conv-01",
  callerNumber: "+32477000001",
  type: "plomberie",
  urgency: "high" as const,
  location: "Bruxelles",
  availability: "demain",
  summary: "Fuite d'eau urgente.",
};

beforeEach(() => vi.clearAllMocks());

describe("upsertLead", () => {
  it("crée le lead et retourne son id", async () => {
    mockDb.lead.upsert.mockResolvedValue({ id: "lead-01" });

    const id = await upsertLead(BASE_PARAMS);

    expect(id).toBe("lead-01");
    expect(mockDb.lead.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { conversationId: "conv-01" },
        create: expect.objectContaining({ urgency: "high", type: "plomberie" }),
      })
    );
  });

  it("accepte urgency null sans planter", async () => {
    mockDb.lead.upsert.mockResolvedValue({ id: "lead-02" });

    const id = await upsertLead({ ...BASE_PARAMS, urgency: null });

    expect(id).toBe("lead-02");
    expect(mockDb.lead.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ urgency: null }),
      })
    );
  });
});
