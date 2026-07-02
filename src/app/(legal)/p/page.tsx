import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Informations pour les appelants",
  robots: { index: false },
};

// J4 (audit) : page d'information courte destinée aux appelants qui reçoivent
// un SMS (art. 13/14 RGPD). URL volontairement courte : rappl.be/p
export default function CallerInfoPage() {
  return (
    <article>
      <h1>Vous avez reçu un SMS ?</h1>
      <p>
        Vous avez appelé une entreprise qui n&apos;a pas pu décrocher. Son
        service de messages, opéré par Rappl, vous a envoyé un SMS pour
        comprendre votre demande et permettre à l&apos;entreprise de vous
        rappeler au bon moment. La conversation est traitée par un système
        automatisé ; un collaborateur de l&apos;entreprise prend le relais pour
        vous rappeler.
      </p>

      <h2>Vos données</h2>
      <ul>
        <li>
          Données traitées : votre numéro, l&apos;heure de votre appel et les
          SMS échangés.
        </li>
        <li>
          Elles servent uniquement à ce que l&apos;entreprise vous recontacte —
          jamais de publicité.
        </li>
        <li>Elles sont supprimées automatiquement après 12 mois.</li>
        <li>
          Répondez <strong>STOP</strong> pour ne plus recevoir aucun message.
        </li>
      </ul>

      <p>
        Détails complets :{" "}
        <Link href="/confidentialite">politique de confidentialité</Link> —
        questions : <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </article>
  );
}
