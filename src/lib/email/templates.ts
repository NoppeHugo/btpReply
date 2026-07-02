// ── Shared helpers ─────────────────────────────────────────────────────────

const URGENCY_FR: Record<string, string> = {
  low: "Faible",
  medium: "Modérée",
  high: "Élevée",
};

function row(label: string, value: string | null | undefined): string {
  if (!value) return "";
  return `<tr>
    <td style="padding:4px 12px 4px 0;color:#555;font-weight:600;white-space:nowrap">${label}</td>
    <td style="padding:4px 0">${value}</td>
  </tr>`;
}

// ── P4-T1 : alerte lead ───────────────────────────────────────────────────

export interface LeadAlertParams {
  callerNumber: string;
  type: string | null;
  urgency: "low" | "medium" | "high" | null;
  location: string | null;
  availability: string | null;
  summary: string;
  needs_human: boolean;
}

export function buildLeadAlertEmail(p: LeadAlertParams): {
  subject: string;
  html: string;
} {
  const urgencyLabel = p.urgency ? URGENCY_FR[p.urgency] : null;
  const subjectPrefix = p.needs_human ? "⚠️ Action requise" : "🔔 Nouveau lead";
  const typeLabel = p.type ?? "Travaux";

  const subject = urgencyLabel
    ? `${subjectPrefix} — ${typeLabel} | Urgence ${urgencyLabel}`
    : `${subjectPrefix} — ${typeLabel}`;

  const html = `<div style="font-family:sans-serif;max-width:600px;line-height:1.5">
  <h2 style="margin:0 0 16px">${subject}</h2>
  <table style="border-collapse:collapse;margin-bottom:16px">
    ${row("Numéro", p.callerNumber)}
    ${row("Type de travaux", p.type)}
    ${row("Urgence", urgencyLabel)}
    ${row("Lieu", p.location)}
    ${row("Disponibilité", p.availability)}
  </table>
  <p style="background:#f5f5f5;padding:12px;border-radius:6px;margin:0 0 16px">
    <strong>Résumé :</strong> ${p.summary}
  </p>
  ${
    p.needs_human
      ? `<p style="color:#b91c1c;font-weight:600">
          Ce client nécessite un rappel rapide de votre part.
        </p>`
      : ""
  }
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:16px 0"/>
  <p style="color:#999;font-size:12px;margin:0">
    btpReply — Ne perdez plus jamais un client
  </p>
</div>`;

  return { subject, html };
}

// ── F2 (audit) : réponse d'un client après handoff ─────────────────────────

export interface HandoffReplyAlertParams {
  callerNumber: string;
  messageBody: string;
}

export function buildHandoffReplyAlertEmail(p: HandoffReplyAlertParams): {
  subject: string;
  html: string;
} {
  const subject = `⚠️ Le client ${p.callerNumber} a répondu — rappel attendu`;

  const html = `<div style="font-family:sans-serif;max-width:600px;line-height:1.5">
  <h2 style="margin:0 0 16px">Un client en attente de rappel a répondu</h2>
  <table style="border-collapse:collapse;margin-bottom:16px">
    ${row("Numéro", p.callerNumber)}
  </table>
  <p style="background:#f5f5f5;padding:12px;border-radius:6px;margin:0 0 16px">
    <strong>Son message :</strong> ${p.messageBody}
  </p>
  <p style="color:#b91c1c;font-weight:600">
    Cette conversation vous a été transmise : le secrétariat n'y répond plus.
    Rappelez ce client rapidement.
  </p>
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:16px 0"/>
  <p style="color:#999;font-size:12px;margin:0">
    btpReply — Ne perdez plus jamais un client
  </p>
</div>`;

  return { subject, html };
}

// ── P4-T2/T3/T4 : récap quotidien ────────────────────────────────────────

export interface RecapData {
  clientName: string;
  dateLabel: string;
  today: {
    callsCaptured: number;
    leadsQualified: number;
    leadsToCallback: number;
  };
  month: {
    callsCaptured: number;
    leadsQualified: number;
  };
}

export function buildDailyRecapEmail(d: RecapData): {
  subject: string;
  html: string;
} {
  const subject = `Récap du ${d.dateLabel} — ${d.clientName}`;

  const html = `<div style="font-family:sans-serif;max-width:600px;line-height:1.6">
  <h2 style="margin:0 0 8px">Récap du ${d.dateLabel}</h2>
  <p style="color:#555;margin:0 0 20px">${d.clientName}</p>

  <h3 style="margin:0 0 8px;font-size:15px;color:#333">Aujourd'hui</h3>
  <table style="border-collapse:collapse;margin-bottom:20px;width:100%">
    <tr style="background:#f9f9f9">
      <td style="padding:8px 12px">📞 Appels captés</td>
      <td style="padding:8px 12px;font-weight:700;text-align:right">${d.today.callsCaptured}</td>
    </tr>
    <tr>
      <td style="padding:8px 12px">✅ Leads qualifiés</td>
      <td style="padding:8px 12px;font-weight:700;text-align:right">${d.today.leadsQualified}</td>
    </tr>
    <tr style="background:#f9f9f9">
      <td style="padding:8px 12px">⏳ En attente de rappel</td>
      <td style="padding:8px 12px;font-weight:700;text-align:right">${d.today.leadsToCallback}</td>
    </tr>
  </table>

  <h3 style="margin:0 0 8px;font-size:15px;color:#333">Ce mois-ci</h3>
  <table style="border-collapse:collapse;margin-bottom:20px;width:100%">
    <tr style="background:#f9f9f9">
      <td style="padding:8px 12px">📞 Appels captés</td>
      <td style="padding:8px 12px;font-weight:700;text-align:right">${d.month.callsCaptured}</td>
    </tr>
    <tr>
      <td style="padding:8px 12px">✅ Leads qualifiés</td>
      <td style="padding:8px 12px;font-weight:700;text-align:right">${d.month.leadsQualified}</td>
    </tr>
  </table>

  <hr style="border:none;border-top:1px solid #e5e5e5;margin:16px 0"/>
  <p style="color:#999;font-size:12px;margin:0">
    btpReply — Ne perdez plus jamais un client
  </p>
</div>`;

  return { subject, html };
}
