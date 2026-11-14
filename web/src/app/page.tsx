import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { CATEGORIES } from "@/lib/listing";
import { ListingGrid, cardSelect } from "./listing-card";

// Shows the latest listings from the database, so it is rendered on each request.
export const instant = false;
// Set here and not in the layout: a canonical address in the layout would be inherited by every page.
export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function Home() {
  const latest = await prisma.listing.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: 8,
    select: cardSelect,
  });

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <span className="eyebrow">Achat · Vente · Location — Côte d&apos;Ivoire</span>
          <h1>Achetez, louez, vendez. Chaque véhicule a une identité vérifiable.</h1>
          <p>Voitures, motos et utilitaires à Abidjan. Chaque annonce est contrôlée avant sa publication.</p>
          <form action="/annonces" className="search">
            <div className="field">
              <label htmlFor="h-cat">Catégorie</label>
              <select id="h-cat" name="categorie" defaultValue="">
                <option value="">Toutes</option>
                {Object.entries(CATEGORIES).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field grow">
              <label htmlFor="h-q">Marque ou modèle</label>
              <input id="h-q" name="q" placeholder="Toyota, Hilux, MT-07…" />
            </div>
            <button className="btn btn-primary">Rechercher</button>
          </form>
        </div>
      </section>

      <section className="trust" aria-label="Engagements">
        <ul className="wrap">
          <li>
            <strong>Passeport et QR AVS</strong>
            <span className="muted">Une identité vérifiable par véhicule</span>
          </li>
          <li>
            <strong>Échanges sur MonAuto</strong>
            <span className="muted">Ni téléphone ni e-mail ne sont affichés</span>
          </li>
          <li>
            <strong>Localisation approximative</strong>
            <span className="muted">Seule la commune est visible</span>
          </li>
          <li>
            <strong>Signalement</strong>
            <span className="muted">Une annonce douteuse se signale en un geste</span>
          </li>
        </ul>
      </section>

      <section className="section wrap">
        <h2>Annonces récentes à Abidjan</h2>
        {latest.length ? (
          <ListingGrid listings={latest} />
        ) : (
          <div className="empty">
            <p className="muted">Aucune annonce pour l&apos;instant. Soyez le premier à vendre.</p>
            <Link href="/vendre" className="btn btn-primary">
              Publier une annonce
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
