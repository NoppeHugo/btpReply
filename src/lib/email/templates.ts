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

// ── Nouveau message après qualification / transmission ────────────────────

export function buildInboundMessageAlertEmail(p: {
  callerNumber: string;
  body: string;
  afterHandoff: boolean;
}): { subject: string; html: string } {
  const contexte = p.afterHandoff
    ? "après transmission (on vous a demandé de rappeler)"
    : "après qualification";
  const subject = `💬 Nouveau message de ${p.callerNumber}`;

  const html = `<div style="font-family:sans-serif;max-width:600px;line-height:1.5">
  <h2 style="margin:0 0 8px">Nouveau message client</h2>
  <p style="color:#555;margin:0 0 16px">Ce client vous a écrit ${contexte}. Le robot ne répond plus automatiquement — à vous de reprendre.</p>
  <table style="border-collapse:collapse;margin-bottom:16px">
    ${row("Numéro", p.callerNumber)}
  </table>
  <p style="background:#f5f5f5;padding:12px;border-radius:6px;margin:0 0 16px">
    <strong>Message :</strong> ${p.body}
  </p>
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:16px 0"/>
  <p style="color:#999;font-size:12px;margin:0">
    btpReply — Ne perdez plus jamais un client
  </p>
</div>`;

  return { subject, html };
}

// ── P4-T2/T3/T4 : récap quotidien ────────────────────────────────────────

export interface RecapLead {
  callerNumber: string;
  type: string | null;
  urgency: "low" | "medium" | "high" | null;
  summary: string;
  status: "new" | "to_callback" | "done";
  partial: boolean;
}

export interface RecapData {
  clientName: string;
  dateLabel: string;
  today: {
    callsCaptured: number;
    leadsQualified: number;
    leadsToCallback: number;
  };
  leads: RecapLead[];
  month: {
    callsCaptured: number;
    leadsQualified: number;
  };
}

function leadCard(l: RecapLead): string {
  const urgencyLabel = l.urgency ? URGENCY_FR[l.urgency] : null;
  const urgencyColor =
    l.urgency === "high" ? "#b91c1c" : l.urgency === "medium" ? "#b45309" : "#3f6212";
  const badges: string[] = [];
  if (urgencyLabel) {
    badges.push(
      `<span style="background:${urgencyColor};color:#fff;font-size:11px;padding:2px 8px;border-radius:10px">Urgence ${urgencyLabel}</span>`
    );
  }
  if (l.partial) {
    badges.push(
      `<span style="background:#6b7280;color:#fff;font-size:11px;padding:2px 8px;border-radius:10px">À compléter</span>`
    );
  }

  // Layout en table (et non flex) : Gmail gère mal flexbox dans les emails.
  return `<div style="border:1px solid #e5e5e5;border-radius:8px;padding:12px;margin-bottom:10px">
    <table style="width:100%;border-collapse:collapse;margin-bottom:6px">
      <tr>
        <td style="font-size:15px;font-weight:700">${l.type ?? "Demande"}</td>
        <td style="text-align:right">
          <a href="tel:${l.callerNumber}" style="color:#1d4ed8;text-decoration:none;font-weight:600">${l.callerNumber}</a>
        </td>
      </tr>
    </table>
    ${badges.length ? `<div style="margin-bottom:6px">${badges.join(" ")}</div>` : ""}
    <div style="color:#444;font-size:14px">${l.summary}</div>
  </div>`;
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

  ${
    d.leads.length > 0
      ? `<h3 style="margin:0 0 8px;font-size:15px;color:#333">Leads du jour — à rappeler</h3>
  <div style="margin-bottom:20px">
    ${d.leads.map(leadCard).join("")}
  </div>`
      : ""
  }

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
