import { describe, it, expect } from "vitest";
import { isOptOutMessage, isOptInMessage } from "./optout";

describe("isOptOutMessage", () => {
  it.each([
    "STOP",
    "stop",
    "Stop.",
    "STOP SVP",
    "stop svp merci",
    " Stop ",
    "STOP!",
    "Arrêt",
    "arret",
    "Désinscription",
    "desabonnement",
    "Stoppen",
    "Uitschrijven aub",
    "afmelden",
    "UIT",
  ])("détecte « %s » comme opt-out", (msg) => {
    expect(isOptOutMessage(msg)).toBe(true);
  });

  it.each([
    "Bonjour, j'ai une fuite d'eau",
    "Pouvez-vous stopper la fuite ?",
    "Je suis disponible demain",
    "Uiteraard, dank u",
    "",
    "   ",
  ])("ne détecte pas « %s » comme opt-out", (msg) => {
    expect(isOptOutMessage(msg)).toBe(false);
  });
});

describe("isOptInMessage", () => {
  it.each(["START", "start", "Start.", "UNSTOP", "hervat"])(
    "détecte « %s » comme opt-in",
    (msg) => {
      expect(isOptInMessage(msg)).toBe(true);
    }
  );

  it.each(["start demain", "je veux redémarrer les travaux", ""])(
    "ne détecte pas « %s » comme opt-in",
    (msg) => {
      expect(isOptInMessage(msg)).toBe(false);
    }
  );
});
