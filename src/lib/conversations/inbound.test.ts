import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/conversations/service", () => ({
  findOpenConversationForInbound: vi.fn(),
  getConversationForLLM: vi.fn(),
  messageExistsByProviderId: vi.fn(),
  recordMessage: vi.fn(),
  updateConversationLanguage: vi.fn(),
  updateConversationState: vi.fn(),
}));
vi.mock("@/lib/llm/qualification", () => ({ qualifyMessage: vi.fn() }));
vi.mock("@/lib/leads/service", () => ({ upsertLead: vi.fn() }));
vi.mock("@/lib/alerts/service", () => ({
  sendLeadAlert: vi.fn(),
  sendInboundMessageAlert: vi.fn(),
}));
vi.mock("@/lib/sms/service", () => ({
  sendSms: vi.fn(),
  buildStopConfirmationBody: vi.fn(() => "STOP-OK"),
}));
vi.mock("@/lib/whitelist/service", () => ({
  isNumberExcluded: vi.fn(),
  addToOptOutList: vi.fn(),
}));
vi.mock("@/lib/language/detect", () => ({ detectLanguage: vi.fn(() => "fr") }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { processInboundSms } from "./inbound";
import {
  findOpenConversationForInbound,
  getConversationForLLM,
  messageExistsByProviderId,
  recordMessage,
} from "@/lib/conversations/service";
import { qualifyMessage } from "@/lib/llm/qualification";
import { sendSms } from "@/lib/sms/service";
import { sendInboundMessageAlert } from "@/lib/alerts/service";
import { isNumberExcluded, addToOptOutList } from "@/lib/whitelist/service";

const mocked = {
  findConv: findOpenConversationForInbound as ReturnType<typeof vi.fn>,
  getForLLM: getConversationForLLM as ReturnType<typeof vi.fn>,
  msgExists: messageExistsByProviderId as ReturnType<typeof vi.fn>,
  record: recordMessage as ReturnType<typeof vi.fn>,
  qualify: qualifyMessage as ReturnType<typeof vi.fn>,
  send: sendSms as ReturnType<typeof vi.fn>,
  inboundAlert: sendInboundMessageAlert as ReturnType<typeof vi.fn>,
  excluded: isNumberExcluded as ReturnType<typeof vi.fn>,
  optOut: addToOptOutList as ReturnType<typeof vi.fn>,
};

const openConv = {
  id: "conv-1",
  clientId: "c1",
  callId: "call-1",
  turnCount: 1,
  autopilot: true,
  senderNumber: "+320000",
  state: "open",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocked.msgExists.mockResolvedValue(false);
  mocked.findConv.mockResolvedValue(openConv);
  mocked.excluded.mockResolvedValue(false);
  mocked.record.mockResolvedValue("msg-1");
  mocked.send.mockResolvedValue("reply-1");
});

describe("processInboundSms — idempotence", () => {
  it("ignore un message déjà traité sans effet de bord (retry Twilio)", async () => {
    mocked.msgExists.mockResolvedValue(true);

    const outcome = await processInboundSms({
      callerNumber: "+32477000001",
      receiver: "+320000",
      messageBody: "Bonjour",
      providerMessageId: "prov-42",
    });

    expect(outcome).toBe("duplicate");
    // Aucun retraitement : ni conversation, ni LLM, ni SMS de réponse.
    expect(mocked.findConv).not.toHaveBeenCalled();
    expect(mocked.qualify).not.toHaveBeenCalled();
    expect(mocked.send).not.toHaveBeenCalled();
    expect(mocked.record).not.toHaveBeenCalled();
  });

  it("traite normalement quand le providerMessageId est nouveau", async () => {
    mocked.getForLLM.mockResolvedValue({
      clientName: "ACME",
      language: "fr",
      messages: [{ role: "user", content: "Bonjour" }],
    });
    mocked.qualify.mockResolvedValue({
      reply: "Bonjour, comment aider ?",
      qualification: { type: null, urgency: null, location: null, availability: null, summary: "" },
      complete: false,
      needs_human: false,
    });

    const outcome = await processInboundSms({
      callerNumber: "+32477000001",
      receiver: "+320000",
      messageBody: "Bonjour",
      providerMessageId: "prov-new",
    });

    expect(outcome).toBe("qualified");
    expect(mocked.qualify).toHaveBeenCalledOnce();
    expect(mocked.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "+32477000001", body: "Bonjour, comment aider ?" })
    );
  });
});

describe("processInboundSms — chemins prioritaires", () => {
  it("sans expéditeur → no_caller, aucune requête", async () => {
    const outcome = await processInboundSms({ callerNumber: "", messageBody: "x" });
    expect(outcome).toBe("no_caller");
    expect(mocked.msgExists).not.toHaveBeenCalled();
    expect(mocked.findConv).not.toHaveBeenCalled();
  });

  it("sans conversation ouverte → no_conversation", async () => {
    mocked.findConv.mockResolvedValue(null);
    const outcome = await processInboundSms({
      callerNumber: "+32477000001",
      messageBody: "Bonjour",
    });
    expect(outcome).toBe("no_conversation");
    expect(mocked.qualify).not.toHaveBeenCalled();
  });

  it("STOP → opt-out confirmé, pas de qualification", async () => {
    const outcome = await processInboundSms({
      callerNumber: "+32477000001",
      receiver: "+320000",
      messageBody: "  stop ",
      providerMessageId: "prov-stop",
    });
    expect(outcome).toBe("stopped");
    expect(mocked.optOut).toHaveBeenCalledWith("c1", "+32477000001");
    expect(mocked.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "+32477000001", body: "STOP-OK" })
    );
    expect(mocked.qualify).not.toHaveBeenCalled();
  });

  it("numéro en liste blanche → excluded, pas d'enregistrement ni LLM", async () => {
    mocked.excluded.mockResolvedValue(true);
    const outcome = await processInboundSms({
      callerNumber: "+32477000001",
      messageBody: "Bonjour",
    });
    expect(outcome).toBe("excluded");
    expect(mocked.record).not.toHaveBeenCalled();
    expect(mocked.qualify).not.toHaveBeenCalled();
  });

  it("conversation en mode manuel → message enregistré, bot en pause", async () => {
    mocked.findConv.mockResolvedValue({ ...openConv, autopilot: false });
    const outcome = await processInboundSms({
      callerNumber: "+32477000001",
      messageBody: "Bonjour",
    });
    expect(outcome).toBe("manual");
    expect(mocked.record).toHaveBeenCalledOnce();
    expect(mocked.qualify).not.toHaveBeenCalled();
  });

  it("conversation qualifiée → message enregistré + patron alerté, pas de bot", async () => {
    mocked.findConv.mockResolvedValue({ ...openConv, state: "qualified" });
    const outcome = await processInboundSms({
      callerNumber: "+32477000001",
      messageBody: "Une precision",
    });
    expect(outcome).toBe("notified");
    expect(mocked.record).toHaveBeenCalledOnce();
    expect(mocked.qualify).not.toHaveBeenCalled();
    expect(mocked.inboundAlert).toHaveBeenCalledWith("c1", "+32477000001", "Une precision", false);
  });

  it("conversation transmise (handed_off) → alerte patron avec afterHandoff=true", async () => {
    mocked.findConv.mockResolvedValue({ ...openConv, state: "handed_off" });
    const outcome = await processInboundSms({
      callerNumber: "+32477000001",
      messageBody: "Vous me rappelez quand ?",
    });
    expect(outcome).toBe("notified");
    expect(mocked.inboundAlert).toHaveBeenCalledWith(
      "c1",
      "+32477000001",
      "Vous me rappelez quand ?",
      true
    );
    expect(mocked.qualify).not.toHaveBeenCalled();
  });
});
