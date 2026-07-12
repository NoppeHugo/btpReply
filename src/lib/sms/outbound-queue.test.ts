import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    outboundSmsJob: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    client: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/calls/service", () => ({
  sendInitialSmsNow: vi.fn(),
}));
vi.mock("@/lib/alerts/admin", () => ({
  sendAdminAlert: vi.fn(),
}));

import { runOutboundQueue } from "./outbound-queue";
import { db } from "@/lib/db";
import { sendInitialSmsNow } from "@/lib/calls/service";
import { sendAdminAlert } from "@/lib/alerts/admin";

const mockDb = db as unknown as {
  outboundSmsJob: {
    findFirst: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

const JOB = {
  id: "job-1",
  clientId: "client-1",
  callId: "call-1",
  callerNumber: "+32477000001",
  attempts: 0,
};

describe("runOutboundQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // reclaimStaleJobs → updateMany appelé en premier
    mockDb.outboundSmsJob.updateMany.mockResolvedValue({ count: 0 });
    mockDb.outboundSmsJob.update.mockResolvedValue({});
  });

  it("traite un job échu et le marque done", async () => {
    mockDb.outboundSmsJob.findFirst
      .mockResolvedValueOnce(JOB)
      .mockResolvedValueOnce(null);
    // claim CAS réussi
    mockDb.outboundSmsJob.updateMany
      .mockResolvedValueOnce({ count: 0 }) // reclaim
      .mockResolvedValueOnce({ count: 1 }); // claim
    (sendInitialSmsNow as ReturnType<typeof vi.fn>).mockResolvedValue("sent");

    const processed = await runOutboundQueue();

    expect(processed).toBe(1);
    expect(sendInitialSmsNow).toHaveBeenCalledWith("call-1", "client-1", "+32477000001");
    expect(mockDb.outboundSmsJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "done" } })
    );
  });

  it("remet en pending après un échec non définitif", async () => {
    mockDb.outboundSmsJob.findFirst
      .mockResolvedValueOnce(JOB)
      .mockResolvedValueOnce(null);
    mockDb.outboundSmsJob.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    (sendInitialSmsNow as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("twilio down"));

    await runOutboundQueue();

    expect(mockDb.outboundSmsJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "pending", attempts: 1 }),
      })
    );
    expect(sendAdminAlert).not.toHaveBeenCalled();
  });

  it("passe en failed au 3e échec et alerte l'admin", async () => {
    mockDb.outboundSmsJob.findFirst
      .mockResolvedValueOnce({ ...JOB, attempts: 2 })
      .mockResolvedValueOnce(null);
    mockDb.outboundSmsJob.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    (sendInitialSmsNow as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("twilio down"));

    await runOutboundQueue();

    expect(mockDb.outboundSmsJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "failed", attempts: 3 }),
      })
    );
    expect(sendAdminAlert).toHaveBeenCalled();
  });

  it("ne traite pas un job réclamé par un autre worker (CAS perdu)", async () => {
    mockDb.outboundSmsJob.findFirst.mockResolvedValueOnce(JOB);
    mockDb.outboundSmsJob.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 }); // claim perdu

    const processed = await runOutboundQueue();

    expect(processed).toBe(0);
    expect(sendInitialSmsNow).not.toHaveBeenCalled();
  });
});
