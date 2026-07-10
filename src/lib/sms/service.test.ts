import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/twilio/sms", () => ({ twilioSmsSend: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn() } }));

import { sendSms } from "./service";
import { twilioSmsSend } from "@/lib/twilio/sms";

const mockSend = twilioSmsSend as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockSend.mockResolvedValue("SM123");
});

describe("sendSms", () => {
  it("délègue à twilioSmsSend avec l'expéditeur du client et retourne le sid", async () => {
    const id = await sendSms({ to: "+32477000001", from: "+320001", body: "Bonjour" });

    expect(id).toBe("SM123");
    expect(mockSend).toHaveBeenCalledWith({
      to: "+32477000001",
      from: "+320001",
      message: "Bonjour",
    });
  });

  it("lève si aucun expéditeur (from) n'est fourni — il n'y a plus d'expéditeur global", async () => {
    await expect(sendSms({ to: "+32477000001", body: "x" })).rejects.toThrow(/from/);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
