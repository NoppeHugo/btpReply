"use client";

import { useEffect } from "react";

// Enregistre le service worker (public/sw.js) au chargement. Requis pour
// l'installabilité PWA sur Chrome/Android.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
