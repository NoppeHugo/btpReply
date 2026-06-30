import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("l'environnement de test fonctionne", () => {
    expect(1 + 1).toBe(2);
  });
});
