import { NextRequest } from "next/server";
import { getStripeClient } from "@/lib/stripe/client";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import type Stripe from "stripe";

const RELEVANT_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
]);

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    logger.error("STRIPE_WEBHOOK_SECRET manquant");
    return new Response("Configuration error", { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(payload, sig, secret);
  } catch (err) {
    logger.warn({ err }, "Stripe webhook — signature invalide");
    return new Response("Invalid signature", { status: 400 });
  }

  if (!RELEVANT_EVENTS.has(event.type)) {
    return new Response("", { status: 200 });
  }

  try {
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated"
    ) {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;

      const client = await db.client.findFirst({
        where: { stripeCustomerId: customerId },
        select: { id: true },
      });

      if (!client) {
        logger.warn({ customerId }, "Stripe webhook: client introuvable");
        return new Response("", { status: 200 });
      }

      const status = sub.status;
      const active = status === "active" || status === "trialing";

      // Déterminer le plan selon le price ID de la subscription
      const priceId = sub.items.data[0]?.price.id;
      const plan =
        priceId === process.env.STRIPE_PRICE_PLUS ? "plus" : "base";

      await db.client.update({
        where: { id: client.id },
        data: {
          plan,
          stage: active ? "active" : "paused",
        },
      });

      logger.info({ clientId: client.id, plan, status }, "Subscription mise à jour");
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;

      const client = await db.client.findFirst({
        where: { stripeCustomerId: customerId },
        select: { id: true },
      });

      if (client) {
        await db.client.update({
          where: { id: client.id },
          data: { stage: "paused", plan: "base" },
        });
        logger.info({ clientId: client.id }, "Subscription annulée — client mis en pause");
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      logger.warn({ customerId: invoice.customer }, "Paiement Stripe échoué");
    }
  } catch (err) {
    logger.error({ err, eventType: event.type }, "Erreur traitement webhook Stripe");
    return new Response("Internal error", { status: 500 });
  }

  return new Response("", { status: 200 });
}
