import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/twilio/sms", () => ({ twilioSmsSend: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn() } }));

import { sendSms } from "./service";
import { twilioSmsSend } from "@/lib/twilio/sms";

const mockSend = twilioSmsSend as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.TWILIO_SENDER;
  mockSend.mockResolvedValue("SM123");
});

describe("sendSms", () => {
  it("délègue à twilioSmsSend avec l'expéditeur fourni et retourne le sid", async () => {
    const id = await sendSms({ to: "+32477000001", from: "+320001", body: "Bonjour" });

    expect(id).toBe("SM123");
    expect(mockSend).toHaveBeenCalledWith({
      to: "+32477000001",
      from: "+320001",
      message: "Bonjour",
    });
  });

  it("retombe sur TWILIO_SENDER quand aucun expéditeur n'est fourni", async () => {
    process.env.TWILIO_SENDER = "+320000";

    await sendSms({ to: "+32477000001", body: "Salut" });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ from: "+320000" })
    );
  });

  it("lève si aucun expéditeur (paramètre ni TWILIO_SENDER)", async () => {
    await expect(sendSms({ to: "+32477000001", body: "x" })).rejects.toThrow(
      /TWILIO_SENDER/
    );
    expect(mockSend).not.toHaveBeenCalled();
  });
});
