import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ListingGrid, cardSelect } from "../listing-card";

export const instant = false;

export default async function Favoris() {
  const user = await requireUser();
  const listings = await prisma.listing.findMany({
    where: { status: "PUBLISHED", favorites: { some: { userId: user.id } } },
    orderBy: { publishedAt: "desc" },
    select: cardSelect,
  });

  return (
    <div className="section wrap">
      <h1 className="page-title">Mes favoris</h1>
      {listings.length ? (
        <ListingGrid listings={listings} />
      ) : (
        <div className="empty">
          <p className="muted">Aucun favori. Ajoutez une annonce depuis sa page.</p>
          <Link href="/annonces" className="btn btn-primary">
            Voir les annonces
          </Link>
        </div>
      )}
    </div>
  );
}
