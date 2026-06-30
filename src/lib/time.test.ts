import { describe, it, expect } from "vitest";
import { dayBoundsInTz, monthBoundsInTz } from "./time";

// 2026-06-30 à 20:00 heure de Bruxelles = 18:00 UTC (CEST = UTC+2)
const BRUSSELS_SUMMER_EVENING = new Date("2026-06-30T18:00:00Z");
const TZ = "Europe/Brussels";

describe("dayBoundsInTz", () => {
  it("retourne minuit–23h59 de Bruxelles en UTC pour un soir d'été", () => {
    const { start, end } = dayBoundsInTz(TZ, BRUSSELS_SUMMER_EVENING);

    // Minuit Bruxelles CEST = 22:00 UTC la veille
    expect(start.toISOString()).toBe("2026-06-29T22:00:00.000Z");
    // 23:59:59 Bruxelles = 21:59:59 UTC
    expect(end.toISOString()).toBe("2026-06-30T21:59:59.999Z");
  });

  it("la durée est exactement 24 heures", () => {
    const { start, end } = dayBoundsInTz(TZ, BRUSSELS_SUMMER_EVENING);
    expect(end.getTime() - start.getTime()).toBe(86_400_000 - 1);
  });
});

describe("monthBoundsInTz", () => {
  it("retourne 1er juin 00:00 au 30 juin 23:59:59 Bruxelles", () => {
    const { start, end } = monthBoundsInTz(TZ, BRUSSELS_SUMMER_EVENING);

    // 1er juin CEST minuit = 31 mai 22:00 UTC
    expect(start.toISOString()).toBe("2026-05-31T22:00:00.000Z");
    // 30 juin 23:59:59 CEST = 30 juin 21:59:59 UTC
    expect(end.toISOString()).toBe("2026-06-30T21:59:59.999Z");
  });
});
