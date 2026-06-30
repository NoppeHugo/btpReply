import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, HTTP } from "@/lib/api/response";
import { getAuthedUser } from "@/lib/api/auth";
import bcrypt from "bcryptjs";

// GET /api/v1/clients — admin: tous ; owner: son seul client
export async function GET(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return HTTP.unauthorized();

  if (user.role === "admin") {
    const clients = await db.client.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        displayName: true,
        stage: true,
        timezone: true,
        createdAt: true,
        _count: { select: { calls: true, leads: true } },
      },
    });
    return ok(clients);
  }

  const client = await db.client.findUnique({
    where: { id: user.clientId },
    select: {
      id: true,
      name: true,
      displayName: true,
      stage: true,
      timezone: true,
      createdAt: true,
      _count: { select: { calls: true, leads: true } },
    },
  });

  if (!client) return HTTP.notFound("Client introuvable");
  return ok([client]);
}

const createSchema = z.object({
  name: z.string().min(2).max(100),
  timezone: z.string().default("Europe/Brussels"),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8),
  phoneNumber: z.string().regex(/^\+\d{8,15}$/, "Format E.164 requis (+32...)"),
});

// POST /api/v1/clients — onboarding d'un nouveau client (admin only)
export async function POST(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return HTTP.unauthorized();
  if (user.role !== "admin") return HTTP.forbidden();

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return HTTP.badRequest(parsed.error.issues[0]?.message);

  const { name, timezone, ownerEmail, ownerPassword, phoneNumber } = parsed.data;

  // Vérifier unicité email + numéro avant la transaction
  const [existingUser, existingPhone] = await Promise.all([
    db.user.findUnique({ where: { email: ownerEmail }, select: { id: true } }),
    db.phoneNumber.findUnique({ where: { number: phoneNumber }, select: { id: true } }),
  ]);

  if (existingUser) return HTTP.badRequest("Cet email est déjà utilisé");
  if (existingPhone) return HTTP.badRequest("Ce numéro est déjà enregistré");

  const passwordHash = await bcrypt.hash(ownerPassword, 10);

  const result = await db.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: { name, timezone },
      select: { id: true, name: true },
    });

    const owner = await tx.user.create({
      data: {
        clientId: client.id,
        email: ownerEmail,
        role: "owner",
        passwordHash,
      },
      select: { id: true, email: true },
    });

    const phone = await tx.phoneNumber.create({
      data: { clientId: client.id, number: phoneNumber, active: true },
      select: { id: true, number: true },
    });

    return { client, owner, phone };
  });

  return ok(result, 201);
}
