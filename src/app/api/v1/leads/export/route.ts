import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { HTTP } from "@/lib/api/response";
import { getAuthedUser } from "@/lib/api/auth";
import type { LeadStatus } from "@/generated/prisma/enums";

const MAX_ROWS = 5000;

function csvCell(value: string | null | undefined): string {
  const s = value ?? "";
  // RFC 4180 : guillemets doublés, cellule quotée si séparateur/retour/quote.
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// GET /api/v1/leads/export?status=new — export CSV des leads (scopé client)
export async function GET(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return HTTP.unauthorized();

  const { searchParams } = new URL(req.url);
  const statusRaw = searchParams.get("status");
  const status = (statusRaw || undefined) as LeadStatus | undefined;

  const leads = await db.lead.findMany({
    where: {
      ...(user.role === "admin" ? {} : { clientId: user.clientId }),
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
    select: {
      createdAt: true,
      type: true,
      urgency: true,
      location: true,
      availability: true,
      summary: true,
      status: true,
      client: { select: { name: true, displayName: true } },
      conversation: { select: { callerNumber: true } },
    },
  });

  // Point-virgule : convention Excel FR/BE (la virgule casse l'ouverture directe).
  const header = [
    "date",
    "numero",
    "type",
    "urgence",
    "lieu",
    "disponibilite",
    "statut",
    "resume",
    ...(user.role === "admin" ? ["client"] : []),
  ].join(";");

  const rows = leads.map((l) =>
    [
      l.createdAt.toISOString(),
      l.conversation.callerNumber,
      csvCell(l.type),
      l.urgency ?? "",
      csvCell(l.location),
      csvCell(l.availability),
      l.status,
      csvCell(l.summary),
      ...(user.role === "admin"
        ? [csvCell(l.client.displayName ?? l.client.name)]
        : []),
    ].join(";")
  );

  // BOM UTF-8 : sans lui, Excel affiche les accents en mojibake.
  const csv = "﻿" + [header, ...rows].join("\r\n");
  const date = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${date}.csv"`,
    },
  });
}
