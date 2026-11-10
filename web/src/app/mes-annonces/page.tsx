import Link from "next/link";
import { archiveListing } from "../actions";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/listing";
import { requireUser } from "@/lib/session";

export const instant = false;

const statusLabels = {
  PENDING: "En attente de validation",
  PUBLISHED: "En ligne",
  REJECTED: "Refusée",
  ARCHIVED: "Retirée",
} as const;

export default async function MesAnnonces() {
  const user = await requireUser();
  const listings = await prisma.listing.findMany({
    where: { sellerId: user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { conversations: true } } },
  });

  return (
    <div className="section wrap medium">
      <h1 className="page-title">Mes annonces</h1>
      {listings.length === 0 && (
        <div className="empty">
          <p className="muted">Vous n&apos;avez pas encore d&apos;annonce.</p>
          <Link href="/vendre" className="btn btn-primary">
            Déposer une annonce
          </Link>
        </div>
      )}
      <div className="stack">
        {listings.map((listing) => (
          <article key={listing.id} className="card stack">
            <div className="row">
              <div>
                <h2 className="card-title">
                  <Link href={`/annonces/${listing.id}`}>
                    {listing.brand} {listing.model} {listing.year}
                  </Link>
                </h2>
                <p className="muted">{formatPrice(listing.priceFcfa)}</p>
              </div>
              <span className={`status status-${listing.status.toLowerCase()}`}>{statusLabels[listing.status]}</span>
            </div>
            {listing.status === "REJECTED" && <p className="alert">Motif du refus : {listing.rejectionReason}</p>}

            <div className="row start">
              <Link href={`/annonces/${listing.id}/modifier`} className="btn btn-ghost">
                Modifier
              </Link>
              {listing._count.conversations > 0 && (
                <Link href="/messages" className="btn btn-ghost">
                  {listing._count.conversations} conversation{listing._count.conversations > 1 ? "s" : ""}
                </Link>
              )}
              {(listing.status === "PENDING" || listing.status === "PUBLISHED") && (
                <form action={archiveListing}>
                  <input type="hidden" name="id" value={listing.id} />
                  <button className="btn btn-ghost">Retirer l&apos;annonce</button>
                </form>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
