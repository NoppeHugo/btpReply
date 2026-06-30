"use client";

import { useState } from "react";

export default function ClientBilling({
  clientId,
  plan,
  stripeCustomerId,
}: {
  clientId: string;
  plan: string;
  stripeCustomerId: string | null;
}) {
  const [loading, setLoading] = useState<string | null>(null);

  async function openPortal() {
    setLoading("portal");
    try {
      const res = await fetch(`/api/v1/clients/${clientId}/billing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "portal" }),
      });
      const data = await res.json();
      if (data.url) window.open(data.url, "_blank");
    } finally {
      setLoading(null);
    }
  }

  async function startCheckout(p: "base" | "plus") {
    setLoading(`checkout-${p}`);
    try {
      const res = await fetch(`/api/v1/clients/${clientId}/billing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "checkout", plan: p }),
      });
      const data = await res.json();
      if (data.url) window.open(data.url, "_blank");
    } finally {
      setLoading(null);
    }
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="mb-3 font-semibold text-gray-900">Facturation</h2>

      <div className="mb-4 flex items-center gap-3">
        <span className="text-sm text-gray-600">Plan actuel :</span>
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
          {plan}
        </span>
        {stripeCustomerId ? (
          <span className="text-xs text-gray-400">{stripeCustomerId}</span>
        ) : (
          <span className="text-xs text-gray-400">Pas de customer Stripe</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {stripeCustomerId && (
          <button
            onClick={openPortal}
            disabled={loading === "portal"}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {loading === "portal" ? "Ouverture…" : "Portail Stripe →"}
          </button>
        )}
        <button
          onClick={() => startCheckout("base")}
          disabled={!!loading}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading === "checkout-base" ? "…" : "Checkout Base"}
        </button>
        <button
          onClick={() => startCheckout("plus")}
          disabled={!!loading}
          className="rounded-md bg-purple-600 px-3 py-1.5 text-sm text-white hover:bg-purple-700 disabled:opacity-50"
        >
          {loading === "checkout-plus" ? "…" : "Checkout Plus (+39 €)"}
        </button>
      </div>
    </section>
  );
}
