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
  new: "bg-blue-100 text-blue-700",
  to_callback: "bg-yellow-100 text-yellow-800",
  done: "bg-green-100 text-green-700",
};

const URGENCY_BADGE: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-orange-100 text-orange-700",
  high: "bg-red-100 text-red-700",
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
        <h1 className="text-xl font-semibold text-gray-900">Leads</h1>
        <div className="flex gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                filter === opt.value
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isPending && <p className="mb-4 text-sm text-gray-400">Chargement…</p>}

      {!data ? null : data.leads.length === 0 ? (
        <p className="text-sm text-gray-500">Aucun lead pour ce filtre.</p>
      ) : (
        <div className="space-y-3">
          {data.leads.map((lead) => (
            <div
              key={lead.id}
              className="rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-medium">
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
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {lead.type}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      {new Date(lead.createdAt).toLocaleString("fr-BE", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {lead.summary && (
                    <p className="text-sm text-gray-700">{lead.summary}</p>
                  )}
                  {lead.location && (
                    <p className="mt-1 text-xs text-gray-500">
                      📍 {lead.location}
                    </p>
                  )}
                  {lead.availability && (
                    <p className="mt-0.5 text-xs text-gray-500">
                      🕐 {lead.availability}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">
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
          <p className="text-right text-xs text-gray-400">
            {data.total} lead{data.total !== 1 ? "s" : ""} au total
          </p>
        </div>
      )}
    </div>
  );
}
