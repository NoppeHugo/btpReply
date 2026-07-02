import { describe, it, expect } from "vitest";
import {
  sanitizeToGsm7,
  computeSegments,
  enforceSingleSegment,
} from "./segments";

describe("computeSegments", () => {
  it("compte 1 segment pour un texte GSM-7 court", () => {
    const r = computeSegments("Bonjour, c'est Plomberie Martin.");
    expect(r.encoding).toBe("GSM-7");
    expect(r.segments).toBe(1);
  });

  it("accepte les accents FR courants en GSM-7 (é è à ù)", () => {
    expect(computeSegments("réparé à Liège où").encoding).toBe("GSM-7");
  });

  it("bascule en UCS-2 sur un ç minuscule (absent du GSM-7)", () => {
    expect(computeSegments("ça va").encoding).toBe("UCS-2");
  });

  it("passe en UCS-2 dès qu'un emoji est présent", () => {
    const r = computeSegments("Bonjour 👋");
    expect(r.encoding).toBe("UCS-2");
  });

  it("passe en UCS-2 avec un accent circonflexe hors GSM-7", () => {
    expect(computeSegments("vous êtes prêt").encoding).toBe("UCS-2");
  });

  it("compte le € comme 2 unités (extension GSM-7)", () => {
    expect(computeSegments("€").units).toBe(2);
  });

  it("découpe un long texte GSM-7 en plusieurs segments à 153", () => {
    expect(computeSegments("a".repeat(161)).segments).toBe(2);
    expect(computeSegments("a".repeat(160)).segments).toBe(1);
  });
});

describe("sanitizeToGsm7", () => {
  it("translittère la typographie et les accents hors GSM-7", () => {
    expect(sanitizeToGsm7("l'école — c'est prêt…")).toBe("l'école - c'est pret...");
  });

  it("supprime les emoji", () => {
    expect(sanitizeToGsm7("Merci 🙏 !")).toBe("Merci  !");
  });

  it("conserve les accents GSM-7 valides", () => {
    expect(sanitizeToGsm7("réparé à Liège")).toBe("réparé à Liège");
  });
});

describe("enforceSingleSegment", () => {
  it("laisse un message court intact", () => {
    const r = enforceSingleSegment("Bonjour, on vous rappelle vite.");
    expect(r.truncated).toBe(false);
    expect(r.body).toBe("Bonjour, on vous rappelle vite.");
  });

  it("assainit sans tronquer un message avec emoji court", () => {
    const r = enforceSingleSegment("Bonjour 👋 on vous rappelle");
    expect(r.truncated).toBe(false);
    expect(computeSegments(r.body).segments).toBe(1);
  });

  it("tronque un message trop long à 1 segment sur une frontière de mot", () => {
    const long = "mot ".repeat(60).trim();
    const r = enforceSingleSegment(long);
    expect(r.truncated).toBe(true);
    expect(computeSegments(r.body).segments).toBe(1);
    expect(r.body.endsWith("mot")).toBe(true);
  });

  it("garantit 1 segment même sur du UCS-2 long", () => {
    const r = enforceSingleSegment("êtes ".repeat(40));
    expect(computeSegments(r.body).segments).toBe(1);
  });
});
