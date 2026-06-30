import { NextRequest } from "next/server";
import { auth } from "@/auth";

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
  return token === secret;
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
