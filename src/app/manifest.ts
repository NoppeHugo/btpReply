import type { MetadataRoute } from "next";

// Manifest PWA (Next génère automatiquement <link rel="manifest">).
// Icônes : SVG pour le build ; ajouter des PNG 192/512 + apple-touch 180 pour un
// support d'installation complet (voir plan whitelist contacts — prérequis logo).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "btpReply — secrétariat SMS",
    short_name: "btpReply",
    description: "Ne perdez plus un chantier sur un appel manqué.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
