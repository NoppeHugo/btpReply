import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  db: { whitelistEntry: { createMany: vi.fn() } },
}));
vi.mock("@/lib/api/auth", () => ({ getAuthedUser: vi.fn() }));
vi.mock("@/lib/onboarding/import-token", () => ({
  createImportToken: vi.fn(() => "tok"),
  verifyImportToken: vi.fn(),
}));

import { POST, GET } from "./route";
import { db } from "@/lib/db";
import { getAuthedUser } from "@/lib/api/auth";
import { verifyImportToken } from "@/lib/onboarding/import-token";

const mockDb = db as unknown as {
  whitelistEntry: { createMany: ReturnType<typeof vi.fn> };
};
const mockAuth = getAuthedUser as unknown as ReturnType<typeof vi.fn>;
const mockVerify = verifyImportToken as unknown as ReturnType<typeof vi.fn>;

function postReq(body: unknown, query = "") {
  return new NextRequest(
    `http://localhost/api/v1/config/whitelist/import${query}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.whitelistEntry.createMany.mockResolvedValue({ count: 0 });
});

describe("POST /config/whitelist/import", () => {
  it("401 si ni session ni token", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(postReq({ numbers: ["0470123456"] }));
    expect(res.status).toBe(401);
  });

  it("owner : normalise, dédup et insère (2 équivalents → 1)", async () => {
    mockAuth.mockResolvedValue({ userId: "u", clientId: "c1", role: "owner" });
    mockDb.whitelistEntry.createMany.mockResolvedValue({ count: 1 });

    const res = await POST(
      postReq({ numbers: ["0470 12 34 56", "+32470123456", "abc"] })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual({ added: 1, skipped: 0, invalid: 1 });

    const arg = mockDb.whitelistEntry.createMany.mock.calls[0][0];
    expect(arg.data).toHaveLength(1);
    expect(arg.data[0]).toMatchObject({
      clientId: "c1",
      number: "+32470123456",
      source: "contacts_import",
    });
    expect(arg.skipDuplicates).toBe(true);
  });

  it("token d'import : résout le clientId via verifyImportToken", async () => {
    mockAuth.mockResolvedValue(null);
    mockVerify.mockReturnValue("c-token");
    mockDb.whitelistEntry.createMany.mockResolvedValue({ count: 1 });

    const res = await POST(postReq({ numbers: ["0470123456"] }, "?token=abc"));

    expect(res.status).toBe(200);
    expect(mockVerify).toHaveBeenCalledWith("abc");
    expect(mockDb.whitelistEntry.createMany.mock.calls[0][0].data[0].clientId).toBe(
      "c-token"
    );
  });
});

describe("GET /config/whitelist/import", () => {
  it("403 si pas owner", async () => {
    mockAuth.mockResolvedValue({ userId: "a", clientId: "*", role: "admin" });
    const res = await GET(
      new NextRequest("http://localhost/api/v1/config/whitelist/import")
    );
    expect(res.status).toBe(403);
  });

  it("owner : renvoie token + importUrl", async () => {
    mockAuth.mockResolvedValue({ userId: "u", clientId: "c1", role: "owner" });
    const res = await GET(
      new NextRequest("http://localhost/api/v1/config/whitelist/import")
    );
    const json = await res.json();
    expect(json.data.token).toBe("tok");
    expect(json.data.importUrl).toContain("token=tok");
  });
});
