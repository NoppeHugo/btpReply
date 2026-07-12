import crypto from "crypto";
import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export interface AuthedUser {
  userId: string;
  clientId: string;
  role: "admin" | "owner";
}

// ── Bearer token (accès programmatique / app mobile) ──────────────────────

export function extractBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7);
}

export function isValidToken(token: string): boolean {
  const secret = process.env.API_SECRET_KEY;
  if (!secret) return false;
  // Comparaison constant-time : une égalité === laisse fuiter la longueur du
  // préfixe correct via le temps de réponse.
  const given = Buffer.from(token);
  const want = Buffer.from(secret);
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}

// ── Auth unifiée : session cookie OU bearer token ─────────────────────────

/**
 * Retourne l'utilisateur authentifié (session ou bearer), ou null.
 * Bearer API_SECRET_KEY → accès admin complet (pour scripts / app mobile).
 */
export async function getAuthedUser(req: NextRequest): Promise<AuthedUser | null> {
  const token = extractBearerToken(req);
  if (token && isValidToken(token)) {
    return { userId: "api-token", clientId: "*", role: "admin" };
  }

  const session = await auth();
  if (session?.user?.id) {
    // Le JWT vit jusqu'à expiration : re-vérifier en base que le compte est
    // toujours actif permet de révoquer un accès immédiatement (résiliation,
    // compte compromis).
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { active: true },
    });
    if (!user?.active) return null;

    return {
      userId: session.user.id,
      clientId: session.user.clientId,
      role: session.user.role as "admin" | "owner",
    };
  }

  return null;
}

/** Helper : retourne 401 si non authentifié, l'user sinon. */
export async function requireAuth(req: NextRequest): Promise<AuthedUser | null> {
  return getAuthedUser(req);
}
