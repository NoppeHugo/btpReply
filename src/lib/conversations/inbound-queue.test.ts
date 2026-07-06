import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    inboundSmsJob: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));
vi.mock("./inbound", () => ({ processInboundSms: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { enqueueInboundSms, runInboundQueue } from "./inbound-queue";
import { processInboundSms } from "./inbound";
import { db } from "@/lib/db";

const job = db.inboundSmsJob as unknown as {
  findUnique: ReturnType<typeof vi.fn>;
  findFirst: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  updateMany: ReturnType<typeof vi.fn>;
};
const process = processInboundSms as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  job.updateMany.mockResolvedValue({ count: 1 });
  job.update.mockResolvedValue({});
  job.create.mockResolvedValue({ id: "job-1" });
});

describe("enqueueInboundSms", () => {
  it("sans expéditeur → no_caller, aucune écriture", async () => {
    const r = await enqueueInboundSms({ callerNumber: "", messageBody: "x" });
    expect(r).toBe("no_caller");
    expect(job.create).not.toHaveBeenCalled();
  });

  it("providerMessageId déjà en file → duplicate, pas de création", async () => {
    job.findUnique.mockResolvedValue({ id: "existing" });
    const r = await enqueueInboundSms({
      callerNumber: "+32477000001",
      messageBody: "Bonjour",
      providerMessageId: "prov-1",
    });
    expect(r).toBe("duplicate");
    expect(job.create).not.toHaveBeenCalled();
  });

  it("nouveau message → enqueued", async () => {
    job.findUnique.mockResolvedValue(null);
    const r = await enqueueInboundSms({
      callerNumber: "+32477000001",
      messageBody: "Bonjour",
      providerMessageId: "prov-2",
    });
    expect(r).toBe("enqueued");
    expect(job.create).toHaveBeenCalledOnce();
  });

  it("course de retries (P2002 à la création) → duplicate", async () => {
    job.findUnique.mockResolvedValue(null);
    job.create.mockRejectedValue({ code: "P2002" });
    const r = await enqueueInboundSms({
      callerNumber: "+32477000001",
      messageBody: "Bonjour",
      providerMessageId: "prov-3",
    });
    expect(r).toBe("duplicate");
  });
});

describe("runInboundQueue", () => {
  const candidate = {
    id: "job-1",
    callerNumber: "+32477000001",
    receiver: "+320000",
    body: "Bonjour",
    providerMessageId: "prov-1",
    attempts: 0,
  };

  it("réclame un job, le traite et le marque done", async () => {
    job.findFirst.mockResolvedValueOnce(candidate).mockResolvedValueOnce(null);
    job.updateMany
      .mockResolvedValueOnce({ count: 0 }) // reclaimStaleJobs
      .mockResolvedValueOnce({ count: 1 }); // claim
    process.mockResolvedValue("qualified");

    const n = await runInboundQueue();

    expect(n).toBe(1);
    expect(process).toHaveBeenCalledWith(
      expect.objectContaining({ callerNumber: "+32477000001", providerMessageId: "prov-1" })
    );
    expect(job.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "job-1" }, data: { status: "done" } })
    );
  });

  it("en cas d'échec, remet le job en file avec attempts incrémenté", async () => {
    job.findFirst.mockResolvedValueOnce(candidate).mockResolvedValueOnce(null);
    job.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    process.mockRejectedValue(new Error("LLM down"));

    await runInboundQueue();

    expect(job.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-1" },
        data: expect.objectContaining({ status: "pending", attempts: 1 }),
      })
    );
  });

  it("marque failed après MAX_ATTEMPTS échecs", async () => {
    job.findFirst
      .mockResolvedValueOnce({ ...candidate, attempts: 2 })
      .mockResolvedValueOnce(null);
    job.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    process.mockRejectedValue(new Error("LLM down"));

    await runInboundQueue();

    expect(job.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "failed", attempts: 3 }),
      })
    );
  });
});
