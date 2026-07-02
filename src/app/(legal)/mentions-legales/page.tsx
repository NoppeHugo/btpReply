import type { Metadata } from "next";
import {
  COMPANY_ADDRESS,
  COMPANY_BCE,
  COMPANY_LEGAL_NAME,
  CONTACT_EMAIL,
  SITE_DOMAIN,
} from "@/lib/site";

export const metadata: Metadata = {
  title: "Mentions légales",
  robots: { index: false },
};

export default function MentionsLegalesPage() {
  return (
    <article>
      <h1>Mentions légales</h1>

      <h2>Éditeur du site</h2>
      <p>
        Le site {SITE_DOMAIN} et le service Rappl sont édités par{" "}
        {COMPANY_LEGAL_NAME}, inscrite à la Banque-Carrefour des Entreprises
        sous le numéro {COMPANY_BCE}, dont le siège social est situé{" "}
        {COMPANY_ADDRESS}.
      </p>
      <p>
        Contact : <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>

      <h2>Hébergement</h2>
      <p>
        Le site et les données sont hébergés par Hetzner Online GmbH,
        Industriestr. 25, 91710 Gunzenhausen, Allemagne (centres de données en
        Union européenne).
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        L&apos;ensemble des contenus du site (textes, visuels, logo, code) est
        protégé par le droit d&apos;auteur. Toute reproduction sans autorisation
        écrite préalable est interdite.
      </p>

      <h2>Responsabilité</h2>
      <p>
        Les informations publiées sur ce site sont fournies à titre indicatif et
        peuvent être modifiées à tout moment. L&apos;éditeur ne peut être tenu
        responsable des dommages directs ou indirects résultant de
        l&apos;utilisation du site.
      </p>
    </article>
  );
}
