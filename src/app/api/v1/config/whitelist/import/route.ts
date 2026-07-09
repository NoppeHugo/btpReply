import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, HTTP } from "@/lib/api/response";
import { getAuthedUser } from "@/lib/api/auth";
import { normalizeMany } from "@/lib/phone/normalize";
import { createImportToken, verifyImportToken } from "@/lib/onboarding/import-token";

// Import batch de numéros dans la whitelist (répertoire de l'artisan).
// Deux modes d'auth : session owner (Contact Picker Android / upload vCard depuis
// la PWA) OU token d'import signé (Raccourci Apple, qui ne porte pas le cookie).

const postSchema = z.object({
  numbers: z.array(z.string()).max(5000),
  source: z.enum(["contacts_import", "vcard"]).optional(),
  token: z.string().optional(),
});

/** Résout le clientId cible : session owner, sinon token d'import (query/body). */
async function resolveClientId(
  req: NextRequest,
  bodyToken?: string
): Promise<string | null> {
  const user = await getAuthedUser(req);
  if (user && user.role === "owner" && user.clientId !== "*") return user.clientId;

  const token = req.nextUrl.searchParams.get("token") ?? bodyToken ?? null;
  if (token) return verifyImportToken(token);
  return null;
}

// GET : renvoie un token d'import + l'URL prête pour le Raccourci Apple.
export async function GET(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user || user.role !== "owner" || user.clientId === "*") {
    return HTTP.forbidden();
  }
  const token = createImportToken(user.clientId);
  const base = process.env.APP_BASE_URL ?? "";
  return ok({
    token,
    importUrl: `${base}/api/v1/config/whitelist/import?token=${token}`,
  });
}

// POST : normalise en E.164, dédup, insère (skipDuplicates).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return HTTP.badRequest(parsed.error.issues[0]?.message);

  const clientId = await resolveClientId(req, parsed.data.token);
  if (!clientId) return HTTP.unauthorized();

  const { valid, invalid } = normalizeMany(parsed.data.numbers);
  if (valid.length === 0) return ok({ added: 0, skipped: 0, invalid });

  const source = parsed.data.source ?? "contacts_import";
  const res = await db.whitelistEntry.createMany({
    data: valid.map((number) => ({ clientId, number, source })),
    skipDuplicates: true,
  });

  return ok({ added: res.count, skipped: valid.length - res.count, invalid });
}
