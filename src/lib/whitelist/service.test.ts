import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    whitelistEntry: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}));

import { isNumberExcluded, addToOptOutList } from "./service";
import { db } from "@/lib/db";

const mockDb = db as unknown as {
  whitelistEntry: {
    findUnique: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
};

beforeEach(() => vi.clearAllMocks());

describe("isNumberExcluded", () => {
  it("retourne true si une entrée existe", async () => {
    mockDb.whitelistEntry.findUnique.mockResolvedValue({ id: "w1" });
    expect(await isNumberExcluded("c1", "+32477000001")).toBe(true);
  });

  it("retourne false si aucune entrée", async () => {
    mockDb.whitelistEntry.findUnique.mockResolvedValue(null);
    expect(await isNumberExcluded("c1", "+32477000002")).toBe(false);
  });
});

describe("addToOptOutList", () => {
  it("appelle upsert avec label opted_out", async () => {
    mockDb.whitelistEntry.upsert.mockResolvedValue({});
    await addToOptOutList("c1", "+32477000001");
    expect(mockDb.whitelistEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ label: "opted_out" }),
        update: expect.objectContaining({ label: "opted_out" }),
      })
    );
  });
});
