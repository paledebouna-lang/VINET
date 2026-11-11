import Link from "next/link";

export default function NotFound() {
  return (
    <div className="narrow">
      <h1>Page introuvable</h1>
      <p className="muted">Cette page n&apos;existe pas, a été retirée, ou vous n&apos;avez pas le droit de la voir.</p>
      <Link href="/" className="btn btn-primary">
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
