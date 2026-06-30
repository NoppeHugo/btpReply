import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    client: { findUnique: vi.fn() },
    businessHours: { findUnique: vi.fn() },
  },
}));

vi.mock("@/generated/prisma/client", () => ({
  DayOfWeek: {
    monday: "monday", tuesday: "tuesday", wednesday: "wednesday",
    thursday: "thursday", friday: "friday", saturday: "saturday", sunday: "sunday",
  },
}));

import { isWithinBusinessHours } from "./service";
import { db } from "@/lib/db";

const mockDb = db as unknown as {
  client: { findUnique: ReturnType<typeof vi.fn> };
  businessHours: { findUnique: ReturnType<typeof vi.fn> };
};

// Mardi 30 juin 2026 à 10:00 Europe/Brussels = 08:00 UTC
const TUESDAY_10H_UTC = new Date("2026-06-30T08:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.client.findUnique.mockResolvedValue({ timezone: "Europe/Brussels" });
});

describe("isWithinBusinessHours", () => {
  it("retourne true si aucune règle configurée pour ce jour", async () => {
    mockDb.businessHours.findUnique.mockResolvedValue(null);
    expect(await isWithinBusinessHours("c1", TUESDAY_10H_UTC)).toBe(true);
  });

  it("retourne false si le jour est fermé (closed=true)", async () => {
    mockDb.businessHours.findUnique.mockResolvedValue({
      closed: true,
      openTime: "08:00",
      closeTime: "18:00",
    });
    expect(await isWithinBusinessHours("c1", TUESDAY_10H_UTC)).toBe(false);
  });

  it("retourne true si l'heure est dans la plage d'ouverture", async () => {
    mockDb.businessHours.findUnique.mockResolvedValue({
      closed: false,
      openTime: "08:00",
      closeTime: "18:00",
    });
    // 10:00 Brussels → dans la plage 08:00-18:00
    expect(await isWithinBusinessHours("c1", TUESDAY_10H_UTC)).toBe(true);
  });

  it("retourne false si l'heure est hors de la plage", async () => {
    mockDb.businessHours.findUnique.mockResolvedValue({
      closed: false,
      openTime: "08:00",
      closeTime: "18:00",
    });
    // 20:00 Brussels (18:00 UTC) = hors horaires
    const evening = new Date("2026-06-30T18:00:00Z");
    expect(await isWithinBusinessHours("c1", evening)).toBe(false);
  });
});
