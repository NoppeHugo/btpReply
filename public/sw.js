// Service worker minimal — requis par Chrome pour rendre la PWA installable
// (déclenche l'événement beforeinstallprompt). Pass-through réseau : pas de cache
// agressif, l'app est surtout dynamique (on évite de servir du contenu périmé).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // Handler présent volontairement (condition d'installabilité) — laisse le
  // navigateur gérer la requête normalement.
});
