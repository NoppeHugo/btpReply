"use client";

import { useState, useEffect, useTransition } from "react";

type Lead = {
  id: string;
  clientId: string;
  callerNumber: string;
  type: string | null;
  urgency: string | null;
  location: string | null;
  availability: string | null;
  summary: string | null;
  status: string;
  createdAt: string;
  client: { name: string; displayName: string | null };
};

type LeadData = { leads: Lead[]; total: number };

const STATUS_OPTIONS = [
  { value: "", label: "Tous" },
  { value: "new", label: "Nouveau" },
  { value: "to_callback", label: "À rappeler" },
  { value: "done", label: "Traité" },
];

const STATUS_BADGE: Record<string, string> = {
  new: "bg-sky-500/15 text-sky-300",
  to_callback: "bg-amber-500/15 text-amber-300",
  done: "bg-emerald-500/15 text-emerald-300",
};

const URGENCY_BADGE: Record<string, string> = {
  low: "bg-white/10 text-white/60",
  medium: "bg-amber-500/15 text-amber-300",
  high: "bg-red-500/15 text-red-400",
};

export default function LeadsPage() {
  const [filter, setFilter] = useState("");
  const [data, setData] = useState<LeadData | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const qs = filter ? `?status=${filter}` : "";
      const res = await fetch(`/api/v1/leads${qs}`);
      if (res.ok) setData(await res.json());
    });
  }, [filter]);

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/v1/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    startTransition(async () => {
      const qs = filter ? `?status=${filter}` : "";
      const res = await fetch(`/api/v1/leads${qs}`);
      if (res.ok) setData(await res.json());
    });
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="app-h1">Leads</h1>
        <div className="flex gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                filter === opt.value
                  ? "bg-amber-500 font-semibold text-neutral-950"
                  : "border border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isPending && <p className="mb-4 text-sm text-white/40">Chargement…</p>}

      {!data ? null : data.leads.length === 0 ? (
        <p className="app-muted text-sm">Aucun lead pour ce filtre.</p>
      ) : (
        <div className="space-y-3">
          {data.leads.map((lead) => (
            <div key={lead.id} className="app-card-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-medium text-white">
                      {lead.callerNumber}
                    </span>
                    {lead.urgency && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          URGENCY_BADGE[lead.urgency] ?? ""
                        }`}
                      >
                        {lead.urgency}
                      </span>
                    )}
                    {lead.type && (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60">
                        {lead.type}
                      </span>
                    )}
                    <span className="text-xs text-white/30">
                      {new Date(lead.createdAt).toLocaleString("fr-BE", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {lead.summary && (
                    <p className="text-sm text-white/80">{lead.summary}</p>
                  )}
                  {lead.location && (
                    <p className="mt-1 text-xs text-white/50">
                      📍 {lead.location}
                    </p>
                  )}
                  {lead.availability && (
                    <p className="mt-0.5 text-xs text-white/50">
                      🕐 {lead.availability}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-white/30">
                    {lead.client.displayName ?? lead.client.name}
                  </p>
                </div>

                <div className="shrink-0">
                  <select
                    value={lead.status}
                    onChange={(e) => updateStatus(lead.id, e.target.value)}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_BADGE[lead.status] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    <option value="new">Nouveau</option>
                    <option value="to_callback">À rappeler</option>
                    <option value="done">Traité</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
          <p className="text-right text-xs text-white/30">
            {data.total} lead{data.total !== 1 ? "s" : ""} au total
          </p>
        </div>
      )}
    </div>
  );
}
