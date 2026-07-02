import type { Metadata } from "next";
import { COMPANY_LEGAL_NAME, CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Conditions générales de vente",
};

export default function CgvPage() {
  return (
    <article>
      <h1>Conditions générales de vente</h1>
      <p>
        Version de juillet 2026 — applicables à tout abonnement au service
        Rappl souscrit auprès de {COMPANY_LEGAL_NAME}.
      </p>

      <h2>1. Le service</h2>
      <p>
        Rappl détecte les appels manqués du client (via un renvoi d&apos;appel
        conditionnel vers un numéro dédié), envoie un SMS de prise de contact au
        nom du client, mène une conversation automatisée pour préciser la
        demande, alerte le client à chaque demande qualifiée et fournit un
        récapitulatif quotidien ainsi qu&apos;un tableau de bord.
      </p>

      <h2>2. Prix et facturation</h2>
      <p>
        L&apos;abonnement est mensuel, payable d&apos;avance, au tarif en
        vigueur communiqué avant la souscription
        {/* [À VALIDER — fondateurs] ex. 99 €/mois HTVA, numéro supplémentaire +39 €/mois */}
        . La mise en place est offerte. Chaque abonnement couvre un usage
        raisonnable de 100 conversations par mois ; au-delà, un complément
        peut être facturé après information préalable du client.
      </p>

      <h2>3. Garantie premier mois</h2>
      <p>
        Si, au cours du premier mois d&apos;abonnement, le service ne transmet
        au client <strong>aucun contact qualifié</strong> — c&apos;est-à-dire
        aucune demande comprenant au minimum le numéro de l&apos;appelant et la
        nature de son besoin —, le premier mois est intégralement remboursé sur
        simple demande à {CONTACT_EMAIL}. La garantie suppose que le renvoi
        d&apos;appel conditionnel soit resté activé pendant la période.
      </p>

      <h2>4. Durée et résiliation</h2>
      <p>
        L&apos;abonnement est sans engagement : il peut être résilié à tout
        moment, avec effet à la fin de la période mensuelle en cours. Aucun
        remboursement prorata n&apos;est dû pour le mois entamé, hors garantie
        du premier mois.
      </p>

      <h2>5. Obligations du client</h2>
      <ul>
        <li>Activer et maintenir le renvoi d&apos;appel conditionnel.</li>
        <li>
          Rappeler les contacts transmis dans un délai raisonnable — Rappl
          capte les demandes mais ne réalise pas les rappels.
        </li>
        <li>
          Utiliser le service loyalement, à l&apos;exclusion de tout envoi de
          messages non sollicités.
        </li>
      </ul>

      <h2>6. Données personnelles</h2>
      <p>
        Le client demeure responsable du traitement des données de ses
        appelants ; Rappl agit comme sous-traitant conformément à
        l&apos;accord de sous-traitance (art. 28 RGPD) annexé au contrat et à
        la politique de confidentialité publiée sur le site.
      </p>

      <h2>7. Responsabilité</h2>
      <p>
        Rappl est tenu à une obligation de moyens. Le service dépend
        d&apos;opérateurs tiers (réseaux télécoms, envoi de SMS) dont les
        interruptions ne peuvent lui être imputées. La responsabilité de{" "}
        {COMPANY_LEGAL_NAME} est en tout état de cause plafonnée au montant des
        trois derniers mois d&apos;abonnement payés.
      </p>

      <h2>8. Droit applicable</h2>
      <p>
        Les présentes conditions sont soumises au droit belge. Tout litige
        relève des tribunaux de l&apos;arrondissement du siège social, après
        tentative de résolution amiable.
      </p>
    </article>
  );
}
