"use client";

import { useState, useEffect } from "react";
import { Bell, BellOff, Check } from "lucide-react";
import { unwrap } from "@/lib/api/unwrap";

// Active/désactive les notifications push (nouveaux leads) pour cet appareil.
// États : indisponible (navigateur/serveur), refusé, inactif, actif.

type Status =
  | "loading"
  | "unsupported" // navigateur sans Push API
  | "unavailable" // serveur sans clés VAPID
  | "denied"
  | "off"
  | "on";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(b64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function EnablePushButton() {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        setStatus("unsupported");
        return;
      }
      const keyRes = await fetch("/api/v1/push/key").catch(() => null);
      if (!keyRes?.ok) {
        setStatus("unavailable");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? "on" : "off");
    })().catch(() => setStatus("unsupported"));
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }
      const keyRes = await fetch("/api/v1/push/key");
      const { key } = unwrap<{ key: string }>(await keyRes.json());

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      });

      const res = await fetch("/api/v1/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      setStatus(res.ok ? "on" : "off");
    } catch {
      setStatus("off");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/v1/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe();
      }
      setStatus("off");
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") {
    return <p className="text-sm text-white/40">Vérification…</p>;
  }
  if (status === "unsupported") {
    return (
      <p className="text-sm text-white/50">
        Votre navigateur ne prend pas en charge les notifications.
        {" "}Sur iPhone, installez d&apos;abord l&apos;app sur l&apos;écran
        d&apos;accueil.
      </p>
    );
  }
  if (status === "unavailable") {
    return (
      <p className="text-sm text-white/50">
        Les notifications push ne sont pas encore activées sur le serveur.
      </p>
    );
  }
  if (status === "denied") {
    return (
      <p className="text-sm text-white/50">
        Notifications bloquées : autorisez-les dans les réglages de votre
        navigateur pour ce site, puis revenez ici.
      </p>
    );
  }

  if (status === "on") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-sm text-emerald-400">
          <Check className="size-4" /> Notifications activées sur cet appareil
        </span>
        <button
          type="button"
          onClick={disable}
          disabled={busy}
          className="btn-ghost border border-white/10 text-xs"
        >
          <BellOff className="size-3.5" /> Désactiver
        </button>
      </div>
    );
  }

  return (
    <button type="button" onClick={enable} disabled={busy} className="btn-primary">
      <Bell className="size-4" />
      {busy ? "Activation…" : "Activer les notifications"}
    </button>
  );
}
