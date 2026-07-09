import { describe, it, expect } from "vitest";
import { buildLeadAlertEmail, buildDailyRecapEmail } from "./templates";

describe("buildLeadAlertEmail", () => {
  it("construit un sujet avec urgence quand urgency est fourni", () => {
    const { subject } = buildLeadAlertEmail({
      callerNumber: "+32477000001",
      type: "plomberie",
      urgency: "high",
      location: "Bruxelles",
      availability: "demain",
      summary: "Fuite urgente.",
      needs_human: false,
    });

    expect(subject).toContain("Nouveau lead");
    expect(subject).toContain("plomberie");
    expect(subject).toContain("Élevée");
  });

  it("préfixe 'Action requise' quand needs_human=true", () => {
    const { subject, html } = buildLeadAlertEmail({
      callerNumber: "+32477000001",
      type: null,
      urgency: null,
      location: null,
      availability: null,
      summary: "Hors sujet.",
      needs_human: true,
    });

    expect(subject).toContain("Action requise");
    expect(html).toContain("rappel rapide");
  });

  it("omet les lignes null dans le HTML", () => {
    const { html } = buildLeadAlertEmail({
      callerNumber: "+32477000001",
      type: "électricité",
      urgency: "low",
      location: null,
      availability: null,
      summary: "Prise en panne.",
      needs_human: false,
    });

    expect(html).not.toContain("Lieu");
    expect(html).not.toContain("Disponibilité");
    expect(html).toContain("électricité");
  });
});

describe("buildDailyRecapEmail", () => {
  it("inclut les stats dans le sujet et le HTML", () => {
    const { subject, html } = buildDailyRecapEmail({
      clientName: "Plomberie Martin",
      dateLabel: "lundi 30 juin 2026",
      today: { callsCaptured: 5, leadsQualified: 3, leadsToCallback: 1 },
      leads: [],
      month: { callsCaptured: 47, leadsQualified: 31 },
    });

    expect(subject).toContain("Plomberie Martin");
    expect(subject).toContain("30 juin 2026");
    expect(html).toContain("47");
    expect(html).toContain("31");
    expect(html).toContain("En attente de rappel");
    expect(html).toContain("1");
  });

  it("liste les leads du jour avec numéro, type et badges", () => {
    const { html } = buildDailyRecapEmail({
      clientName: "Plomberie Martin",
      dateLabel: "lundi 30 juin 2026",
      today: { callsCaptured: 2, leadsQualified: 1, leadsToCallback: 1 },
      leads: [
        {
          callerNumber: "+32477000001",
          type: "plomberie",
          urgency: "high",
          summary: "Fuite sous l'évier.",
          status: "new",
          partial: false,
        },
        {
          callerNumber: "+32477000002",
          type: null,
          urgency: null,
          summary: "Conversation incomplète.",
          status: "to_callback",
          partial: true,
        },
      ],
      month: { callsCaptured: 47, leadsQualified: 31 },
    });

    expect(html).toContain("Leads du jour");
    expect(html).toContain("+32477000001");
    expect(html).toContain("plomberie");
    expect(html).toContain("Urgence Élevée");
    expect(html).toContain("À compléter"); // badge du lead partiel
    expect(html).toContain("tel:+32477000002"); // lien cliquable
  });
});
