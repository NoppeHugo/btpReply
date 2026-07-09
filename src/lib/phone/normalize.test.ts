import { describe, it, expect } from "vitest";
import { normalizeToE164, normalizeMany } from "./normalize";

describe("normalizeToE164", () => {
  it("normalise les formats belges courants vers E.164", () => {
    expect(normalizeToE164("0470 12 34 56")).toBe("+32470123456");
    expect(normalizeToE164("+32 470 12 34 56")).toBe("+32470123456");
    expect(normalizeToE164("0032470123456")).toBe("+32470123456");
    expect(normalizeToE164("0470/12.34.56")).toBe("+32470123456");
  });

  it("renvoie null pour un numéro invalide ou vide", () => {
    expect(normalizeToE164("12345")).toBeNull();
    expect(normalizeToE164("")).toBeNull();
    expect(normalizeToE164("pas un numéro")).toBeNull();
  });
});

describe("normalizeMany", () => {
  it("dédup les numéros équivalents et compte les invalides", () => {
    const { valid, invalid } = normalizeMany([
      "0470 12 34 56",
      "+32470123456", // doublon du précédent
      "0032470123456", // doublon aussi
      "abc", // invalide
    ]);
    expect(valid).toEqual(["+32470123456"]);
    expect(invalid).toBe(1);
  });
});
