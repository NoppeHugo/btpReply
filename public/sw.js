// Service worker — requis par Chrome pour rendre la PWA installable
// (déclenche l'événement beforeinstallprompt). Pass-through réseau : pas de cache
// agressif, l'app est surtout dynamique (on évite de servir du contenu périmé).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // Handler présent volontairement (condition d'installabilité) — laisse le
  // navigateur gérer la requête normalement.
});

// ── Web Push : notification des nouveaux leads ──────────────────────────────

self.addEventListener("push", (event) => {
  let payload = { title: "Rappl", body: "Nouvelle activité", url: "/dashboard/leads" };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    // payload non-JSON : on garde le message générique
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { url: payload.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/dashboard/leads";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((tabs) => {
      // Réutilise un onglet de l'app si présent, sinon en ouvre un.
      const existing = tabs.find((t) => "focus" in t);
      if (existing) {
        existing.navigate(url);
        return existing.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
