import type { Metadata } from "next";
import Link from "next/link";
import { COMPANY_LEGAL_NAME, CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
};

export default function ConfidentialitePage() {
  return (
    <article>
      <h1>Politique de confidentialité</h1>
      <p>Dernière mise à jour : juillet 2026.</p>

      <h2>Qui sommes-nous ?</h2>
      <p>
        Rappl ({COMPANY_LEGAL_NAME}) fournit aux artisans et PME un service de
        réponse automatisée par SMS aux appels manqués : lorsqu&apos;un appel
        n&apos;aboutit pas, un SMS est envoyé au nom de l&apos;entreprise
        appelée, une conversation permet de préciser la demande, et
        l&apos;entreprise est alertée pour rappeler.
      </p>

      <h2>Nos rôles au sens du RGPD</h2>
      <ul>
        <li>
          <strong>Pour les données des appelants</strong> (numéro de téléphone,
          contenu des SMS échangés) : l&apos;entreprise que vous avez appelée
          est <strong>responsable du traitement</strong> ; Rappl agit comme{" "}
          <strong>sous-traitant</strong> pour son compte, sur la base d&apos;un
          accord de sous-traitance (art. 28 RGPD).
        </li>
        <li>
          <strong>Pour les données de nos clients professionnels</strong> (compte,
          facturation, formulaire de démo) : Rappl est responsable du
          traitement.
        </li>
      </ul>

      <h2>Données traitées et finalités</h2>
      <ul>
        <li>
          Numéro de l&apos;appelant, date et heure de l&apos;appel manqué —
          pour permettre le rappel par l&apos;entreprise.
        </li>
        <li>
          Contenu des SMS échangés — pour comprendre la demande et la
          transmettre à l&apos;entreprise. La conversation est traitée par un
          système automatisé.
        </li>
        <li>
          Coordonnées professionnelles de nos clients — gestion du compte, du
          service et de la facturation.
        </li>
      </ul>
      <p>
        Base légale : l&apos;intérêt légitime de l&apos;entreprise appelée à
        recontacter les personnes qui ont cherché à la joindre, et
        l&apos;exécution du contrat pour nos clients professionnels.
      </p>

      <h2>Désinscription (STOP)</h2>
      <p>
        Répondez <strong>STOP</strong> à tout SMS pour ne plus jamais recevoir
        de messages. La désinscription est immédiate et permanente (répondez
        START pour la lever).
      </p>

      <h2>Durée de conservation</h2>
      <p>
        Les conversations et données d&apos;appels sont supprimées
        automatiquement après <strong>12 mois</strong>. Les données de
        facturation sont conservées conformément aux obligations comptables
        légales.
      </p>

      <h2>Destinataires et sous-traitants</h2>
      <p>
        Les données sont hébergées en Union européenne (Hetzner, Allemagne).
        Pour fournir le service, nous faisons appel à : Twilio (envoi et
        réception des SMS), Anthropic (traitement automatisé des
        conversations), Stripe (paiements), Sentry (surveillance des erreurs)
        et un prestataire d&apos;envoi d&apos;emails. Certains de ces
        prestataires traitent des données hors UE, encadrées par des clauses
        contractuelles types (art. 46 RGPD).
      </p>

      <h2>Vos droits</h2>
      <p>
        Vous disposez des droits d&apos;accès, de rectification,
        d&apos;effacement, de limitation et d&apos;opposition. Écrivez à{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> — si votre
        demande concerne une conversation avec une entreprise cliente, nous la
        transmettons au responsable du traitement. Vous pouvez introduire une
        réclamation auprès de l&apos;Autorité de protection des données
        (autoriteprotectiondonnees.be).
      </p>

      <p>
        Vous avez reçu un SMS de notre part ?{" "}
        <Link href="/p">Informations pour les appelants</Link>.
      </p>
    </article>
  );
}
