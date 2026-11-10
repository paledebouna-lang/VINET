import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/listing";
import { requireUser } from "@/lib/session";
import { ListingCard, cardSelect } from "../listing-card";

export const instant = false;

export default async function Favoris() {
  const user = await requireUser();
  const favorites = await prisma.favorite.findMany({
    where: { userId: user.id, listing: { status: "PUBLISHED" } },
    orderBy: { createdAt: "desc" },
    select: { priceAtSave: true, listing: { select: cardSelect } },
  });

  if (favorites.length === 0) {
    return (
      <div className="section wrap">
        <h1 className="page-title">Mes favoris</h1>
        <div className="empty">
          <p className="muted">Aucun favori. Ajoutez une annonce depuis sa page pour suivre son prix.</p>
          <Link href="/annonces" className="btn btn-primary">
            Voir les annonces
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="section wrap">
      <h1 className="page-title">Mes favoris</h1>
      <p className="muted">Vous êtes prévenu quand le prix d&apos;un favori baisse.</p>
      <form action="/comparer" className="stack">
        <div className="grid">
          {favorites.map(({ listing, priceAtSave }) => (
            <div key={listing.id} className="stack tight">
              <ListingCard listing={listing} />
              {listing.priceFcfa < priceAtSave && (
                <p className="notice">Prix en baisse de {formatPrice(priceAtSave - listing.priceFcfa)}</p>
              )}
              <label className="check">
                <input type="checkbox" name="id" value={listing.id} /> Comparer
              </label>
            </div>
          ))}
        </div>
        <button className="btn btn-ghost">Comparer la sélection (2 à 4 annonces)</button>
      </form>
    </div>
  );
}
