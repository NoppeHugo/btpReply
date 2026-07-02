import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, HTTP } from "@/lib/api/response";
import { sendEmail, FROM_EMAIL } from "@/lib/email/client";
import { CONTACT_EMAIL } from "@/lib/site";
import { logger } from "@/lib/logger";

const schema = z.object({
  name: z.string().min(2).max(100),
  phone: z
    .string()
    .regex(/^[+0-9 ()./-]{8,20}$/, "Numéro de téléphone invalide"),
  company: z.string().max(100).optional(),
  message: z.string().max(1000).optional(),
  // Honeypot anti-spam : rempli uniquement par les bots.
  website: z.string().max(0).optional(),
});

// Rate limit naïf par IP (endpoint public). Suffisant en mono-instance.
const WINDOW_MS = 60 * 60_000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, { count: number; resetAt: number }>();

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > MAX_PER_WINDOW;
}

// POST /api/v1/demo-requests — formulaire public de demande de démo (W1 audit)
export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return HTTP.badRequest("Trop de demandes — réessayez plus tard");
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return HTTP.badRequest(parsed.error.issues[0]?.message);

  // Honeypot rempli → on répond OK sans rien enregistrer.
  if (parsed.data.website) return ok({ received: true }, 201);

  const { name, phone, company, message } = parsed.data;

  const request = await db.demoRequest.create({
    data: { name, phone, company: company || null, message: message || null },
    select: { id: true },
  });

  // Notification aux fondateurs — l'échec d'email ne bloque pas la demande.
  sendEmail({
    from: FROM_EMAIL,
    to: CONTACT_EMAIL,
    subject: `🔔 Demande de démo — ${name}`,
    html: `<div style="font-family:sans-serif;max-width:600px;line-height:1.5">
  <h2 style="margin:0 0 16px">Nouvelle demande de démo</h2>
  <p><strong>Nom :</strong> ${escapeHtml(name)}</p>
  <p><strong>Téléphone :</strong> ${escapeHtml(phone)}</p>
  ${company ? `<p><strong>Entreprise :</strong> ${escapeHtml(company)}</p>` : ""}
  ${message ? `<p><strong>Message :</strong> ${escapeHtml(message)}</p>` : ""}
</div>`,
  }).catch((err) => logger.error({ err }, "Échec notification demande de démo"));

  logger.info({ demoRequestId: request.id }, "Demande de démo enregistrée");
  return ok({ received: true }, 201);
}
