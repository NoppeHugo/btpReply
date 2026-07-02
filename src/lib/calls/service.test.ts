import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    phoneNumber: { findUnique: vi.fn() },
    call: { create: vi.fn(), findUnique: vi.fn() },
    scheduledJob: { create: vi.fn() },
  },
}));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/sms/service", () => ({
  buildInitialSmsBody: vi.fn(),
  sendSms: vi.fn(),
}));
vi.mock("@/lib/conversations/service", () => ({
  getOrCreateConversation: vi.fn(),
  recordMessage: vi.fn(),
}));

import { handleIncomingCall } from "./service";
import { db } from "@/lib/db";

const mockDb = db as unknown as {
  phoneNumber: { findUnique: ReturnType<typeof vi.fn> };
  call: { create: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> };
  scheduledJob: { create: ReturnType<typeof vi.fn> };
};

const BASE_PARAMS = {
  twilioCallSid: "CA123",
  callerNumber: "+32477000001",
  toNumber: "+32499000001",
  calledAt: new Date("2026-06-30T10:00:00Z"),
};

describe("handleIncomingCall", () => {
  beforeEach(() => vi.clearAllMocks());

  it("crée un Call et retourne callId + clientId quand le numéro est connu", async () => {
    mockDb.phoneNumber.findUnique.mockResolvedValue({ id: "phone-01", clientId: "client-01" });
    mockDb.call.findUnique.mockResolvedValue(null);
    mockDb.call.create.mockResolvedValue({ id: "call-01", clientId: "client-01" });

    const result = await handleIncomingCall(BASE_PARAMS);

    expect(result).toEqual({ callId: "call-01", clientId: "client-01", fromNumber: "+32499000001" });
    expect(mockDb.call.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ twilioCallSid: "CA123", callerNumber: "+32477000001" }),
      })
    );
  });

  it("retourne null et ne crée pas de Call si le numéro est inconnu", async () => {
    mockDb.phoneNumber.findUnique.mockResolvedValue(null);

    const result = await handleIncomingCall(BASE_PARAMS);

    expect(result).toBeNull();
    expect(mockDb.call.create).not.toHaveBeenCalled();
  });

  it("est idempotent : un CallSid déjà traité ne crée pas de doublon", async () => {
    mockDb.phoneNumber.findUnique.mockResolvedValue({ id: "phone-01", clientId: "client-01" });
    mockDb.call.findUnique.mockResolvedValue({ id: "call-01" });

    const result = await handleIncomingCall(BASE_PARAMS);

    expect(result).toBeNull();
    expect(mockDb.call.create).not.toHaveBeenCalled();
  });
});
