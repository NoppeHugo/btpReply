import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, HTTP } from "@/lib/api/response";
import { getAuthedUser } from "@/lib/api/auth";
import {
  getOrCreateStripeCustomer,
  createBillingPortalSession,
  createCheckoutSession,
} from "@/lib/stripe/service";

const postSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("portal") }),
  z.object({ action: z.literal("checkout"), plan: z.enum(["base", "plus"]) }),
]);

// GET /api/v1/clients/[id]/billing — infos de facturation
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthedUser(req);
  if (!user) return HTTP.unauthorized();
  if (user.role !== "admin") return HTTP.forbidden();

  const { id } = await params;
  const client = await db.client.findUnique({
    where: { id },
    select: { id: true, plan: true, stripeCustomerId: true, stage: true },
  });

  if (!client) return HTTP.notFound("Client introuvable");
  return ok(client);
}

// POST /api/v1/clients/[id]/billing — portal ou checkout
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthedUser(req);
  if (!user) return HTTP.unauthorized();
  if (user.role !== "admin") return HTTP.forbidden();

  const { id } = await params;
  const exists = await db.client.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return HTTP.notFound("Client introuvable");

  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return HTTP.badRequest(parsed.error.issues[0]?.message);

  const base = `${process.env.APP_BASE_URL}/dashboard/clients/${id}`;

  if (parsed.data.action === "portal") {
    const url = await createBillingPortalSession(id, base);
    return ok({ url });
  }

  const url = await createCheckoutSession(
    id,
    parsed.data.plan,
    `${base}?billing=success`,
    `${base}?billing=cancelled`
  );
  return ok({ url });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Ensure Stripe customer exists (idempotent)
  const user = await getAuthedUser(req);
  if (!user) return HTTP.unauthorized();
  if (user.role !== "admin") return HTTP.forbidden();

  const { id } = await params;
  const stripeCustomerId = await getOrCreateStripeCustomer(id);
  return ok({ stripeCustomerId });
}
