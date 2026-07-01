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
    <section className="app-card">
      <h2 className="app-h2 mb-3">Facturation</h2>

      <div className="mb-4 flex items-center gap-3">
        <span className="text-sm text-white/60">Plan actuel :</span>
        <span className="pill-amber">{plan}</span>
        {stripeCustomerId ? (
          <span className="text-xs text-white/40">{stripeCustomerId}</span>
        ) : (
          <span className="text-xs text-white/40">Pas de customer Stripe</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {stripeCustomerId && (
          <button
            onClick={openPortal}
            disabled={loading === "portal"}
            className="btn-ghost border border-white/10"
          >
            {loading === "portal" ? "Ouverture…" : "Portail Stripe →"}
          </button>
        )}
        <button
          onClick={() => startCheckout("base")}
          disabled={!!loading}
          className="btn-primary"
        >
          {loading === "checkout-base" ? "…" : "Checkout Base"}
        </button>
        <button
          onClick={() => startCheckout("plus")}
          disabled={!!loading}
          className="btn-ghost border border-white/10"
        >
          {loading === "checkout-plus" ? "…" : "Checkout Plus (+39 €)"}
        </button>
      </div>
    </section>
  );
}
