import { describe, it, expect } from "vitest";
import { detectLanguage } from "./detect";

describe("detectLanguage", () => {
  it("détecte le français par défaut", () => {
    expect(detectLanguage("Bonjour, j'ai une fuite d'eau")).toBe("fr");
    expect(detectLanguage("Pouvez-vous me rappeler ?")).toBe("fr");
  });

  it("détecte le néerlandais via mots-clés", () => {
    expect(detectLanguage("Hallo, ik heb een lekkage")).toBe("nl");
    expect(detectLanguage("Bedankt voor uw bericht")).toBe("nl");
    expect(detectLanguage("Goedag, kunt u mij terugbellen?")).toBe("nl");
    expect(detectLanguage("Alstublieft bel mij terug")).toBe("nl");
  });

  it("STOP n'est pas du NL", () => {
    expect(detectLanguage("STOP")).toBe("fr");
  });

  it("insensible à la casse", () => {
    expect(detectLanguage("HALLO hoe gaat het")).toBe("nl");
  });
});
