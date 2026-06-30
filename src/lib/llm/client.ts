import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY manquant");
  _client = new Anthropic({ apiKey });
  return _client;
}

export const QUALIFICATION_MODEL =
  process.env.ANTHROPIC_MODEL_QUALIFICATION ?? "claude-haiku-4-5-20251001";
