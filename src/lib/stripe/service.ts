import { getStripeClient } from "./client";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function getOrCreateStripeCustomer(clientId: string): Promise<string> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, stripeCustomerId: true, users: { where: { role: "owner" }, select: { email: true }, take: 1 } },
  });

  if (!client) throw new Error(`Client ${clientId} introuvable`);

  if (client.stripeCustomerId) return client.stripeCustomerId;

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    name: client.name,
    email: client.users[0]?.email,
    metadata: { clientId },
  });

  await db.client.update({
    where: { id: clientId },
    data: { stripeCustomerId: customer.id },
  });

  logger.info({ clientId, stripeCustomerId: customer.id }, "Stripe customer créé");
  return customer.id;
}

export async function createBillingPortalSession(
  clientId: string,
  returnUrl: string
): Promise<string> {
  const customerId = await getOrCreateStripeCustomer(clientId);
  const stripe = getStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session.url;
}

export async function createCheckoutSession(
  clientId: string,
  plan: "base" | "plus",
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  const customerId = await getOrCreateStripeCustomer(clientId);
  const stripe = getStripeClient();

  const priceId =
    plan === "plus"
      ? process.env.STRIPE_PRICE_PLUS
      : process.env.STRIPE_PRICE_BASE;

  if (!priceId) throw new Error(`STRIPE_PRICE_${plan.toUpperCase()} manquant`);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { clientId },
  });

  return session.url!;
}
