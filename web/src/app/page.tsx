import Link from "next/link";

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="wrap">
          <span className="eyebrow">Achat · Vente · Location — Côte d&apos;Ivoire</span>
          <h1>Achetez, louez, vendez. Chaque véhicule a une identité vérifiable.</h1>
          <p>
            Voitures, motos et utilitaires, avec passeport numérique AVS, vendeurs vérifiés et suivi
            autorisé pendant la location.
          </p>
          <Link href="/connexion" className="btn btn-gold">
            Créer un compte
          </Link>
        </div>
      </section>

      <section className="trust" aria-label="Engagements">
        <ul className="wrap">
          <li>
            <strong>Vendeurs vérifiés</strong>
            <span className="muted">Identité contrôlée avant publication</span>
          </li>
          <li>
            <strong>Passeport et QR AVS</strong>
            <span className="muted">Une identité numérique par véhicule</span>
          </li>
          <li>
            <strong>Suivi autorisé</strong>
            <span className="muted">Expliqué et limité à la durée du contrat</span>
          </li>
          <li>
            <strong>Paiement sécurisé</strong>
            <span className="muted">Traité par CinetPay</span>
          </li>
        </ul>
      </section>

      <section className="section wrap">
        <h2>Annonces à Abidjan</h2>
        <div className="empty">
          <p className="muted">Les premières annonces arrivent bientôt.</p>
          <Link href="/connexion" className="btn btn-primary">
            Créer un compte
          </Link>
        </div>
      </section>
    </>
  );
}
