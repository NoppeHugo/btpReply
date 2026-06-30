"use client";

import { useState, useCallback } from "react";

type Note = {
  id: string;
  body: string;
  createdAt: string;
  authorEmail: string;
};

export default function ClientJournal({
  clientId,
  initialNotes,
}: {
  clientId: string;
  initialNotes: Note[];
}) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [noteBody, setNoteBody] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const [msgBody, setMsgBody] = useState("");
  const [msgChannel, setMsgChannel] = useState<"email" | "in_app">("in_app");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [msgSent, setMsgSent] = useState(false);

  const addNote = useCallback(async () => {
    if (!noteBody.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/v1/clients/${clientId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteBody.trim() }),
      });
      if (res.ok) {
        const note = await res.json();
        setNotes((prev) => [
          { ...note, createdAt: note.createdAt, authorEmail: note.authorEmail },
          ...prev,
        ]);
        setNoteBody("");
      }
    } finally {
      setSavingNote(false);
    }
  }, [clientId, noteBody]);

  const sendMessage = useCallback(async () => {
    if (!msgBody.trim()) return;
    setSendingMsg(true);
    try {
      const res = await fetch(`/api/v1/clients/${clientId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: msgBody.trim(), channel: msgChannel }),
      });
      if (res.ok) {
        setMsgBody("");
        setMsgSent(true);
        setTimeout(() => setMsgSent(false), 3000);
      }
    } finally {
      setSendingMsg(false);
    }
  }, [clientId, msgBody, msgChannel]);

  return (
    <div className="space-y-6">
      {/* Notes internes */}
      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-3 font-semibold text-gray-900">Notes internes</h2>

        <div className="mb-4 flex gap-2">
          <textarea
            rows={2}
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            placeholder="Note interne (visible uniquement par l'équipe btpReply)…"
            className="flex-1 rounded border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={addNote}
            disabled={savingNote || !noteBody.trim()}
            className="self-start rounded-md bg-gray-800 px-3 py-2 text-sm text-white hover:bg-gray-900 disabled:opacity-50"
          >
            Ajouter
          </button>
        </div>

        {notes.length === 0 ? (
          <p className="text-sm text-gray-400">Aucune note.</p>
        ) : (
          <ul className="space-y-2">
            {notes.map((n) => (
              <li
                key={n.id}
                className="rounded-md bg-yellow-50 px-3 py-2 text-sm"
              >
                <p className="text-gray-800">{n.body}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {n.authorEmail} •{" "}
                  {new Date(n.createdAt).toLocaleString("fr-BE", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Message au client */}
      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-3 font-semibold text-gray-900">Message au client</h2>

        <div className="mb-3 flex gap-3">
          <label className="flex items-center gap-1.5 text-sm text-gray-600">
            <input
              type="radio"
              name="channel"
              value="in_app"
              checked={msgChannel === "in_app"}
              onChange={() => setMsgChannel("in_app")}
            />
            Interne
          </label>
          <label className="flex items-center gap-1.5 text-sm text-gray-600">
            <input
              type="radio"
              name="channel"
              value="email"
              checked={msgChannel === "email"}
              onChange={() => setMsgChannel("email")}
            />
            Email
          </label>
        </div>

        <div className="flex gap-2">
          <textarea
            rows={3}
            value={msgBody}
            onChange={(e) => setMsgBody(e.target.value)}
            placeholder="Message à envoyer au propriétaire du compte…"
            className="flex-1 rounded border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={sendMessage}
            disabled={sendingMsg || !msgBody.trim()}
            className="self-start rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {msgSent ? "Envoyé ✓" : "Envoyer"}
          </button>
        </div>
      </section>
    </div>
  );
}
