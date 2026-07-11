import { describe, it, expect, beforeAll } from "vitest";
import {
  createResetToken,
  verifyResetToken,
  peekResetToken,
} from "./reset-token";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret";
});

describe("reset-token", () => {
  it("crée et vérifie un token valide", () => {
    const token = createResetToken("user-1", "hash-abc");
    expect(peekResetToken(token)).toBe("user-1");
    expect(verifyResetToken(token, "hash-abc")).toBe("user-1");
  });

  it("invalide le token après changement de mot de passe (hash différent)", () => {
    const token = createResetToken("user-1", "hash-abc");
    expect(verifyResetToken(token, "hash-NEW")).toBeNull();
  });

  it("fonctionne pour un compte sans mot de passe (invitation)", () => {
    const token = createResetToken("user-2", null);
    expect(verifyResetToken(token, null)).toBe("user-2");
    // Dès que le mot de passe est défini, le lien d'invitation meurt.
    expect(verifyResetToken(token, "hash-set")).toBeNull();
  });

  it("rejette un token expiré", () => {
    const token = createResetToken("user-1", "hash-abc", -1000);
    expect(verifyResetToken(token, "hash-abc")).toBeNull();
  });

  it("rejette un token falsifié", () => {
    const token = createResetToken("user-1", "hash-abc");
    const [b64] = token.split(".");
    expect(verifyResetToken(`${b64}.fausse-signature`, "hash-abc")).toBeNull();
    expect(verifyResetToken("garbage", "hash-abc")).toBeNull();
    expect(verifyResetToken("", "hash-abc")).toBeNull();
  });
});
