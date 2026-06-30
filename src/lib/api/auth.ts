import { NextRequest } from "next/server";

// P6-T1 : remplacé par la vérification JWT complète
// Pour l'instant : vérifie la présence d'un token statique (API_SECRET_KEY)
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

export function requireAuth(
  req: NextRequest
): { authorized: true } | { authorized: false } {
  const token = extractBearerToken(req);
  if (!token || !isValidToken(token)) return { authorized: false };
  return { authorized: true };
}
