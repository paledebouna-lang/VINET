import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/listing";
import { BOOKING_STATUS, formatDay } from "@/lib/rental";
import { requireUser } from "@/lib/session";

export const instant = false;

export default async function Locations() {
  const user = await requireUser();
  const bookings = await prisma.booking.findMany({
    where: { OR: [{ renterId: user.id }, { listing: { sellerId: user.id } }] },
    orderBy: { createdAt: "desc" },
    include: { listing: { select: { brand: true, model: true, year: true, sellerId: true } } },
  });

  return (
    <div className="section wrap medium">
      <h1 className="page-title">Mes locations</h1>
      {bookings.length === 0 && (
        <p className="muted">
          Aucune location. <Link href="/annonces?type=RENT">Voir les véhicules à louer</Link>
        </p>
      )}
      <div className="stack">
        {bookings.map((b) => (
          <Link key={b.id} href={`/locations/${b.id}`} className="card conversation">
            <div className="row">
              <strong>
                {b.listing.brand} {b.listing.model} {b.listing.year}
              </strong>
              <span className="status">{BOOKING_STATUS[b.status]}</span>
            </div>
            <p>
              Du {formatDay(b.startDate)} au {formatDay(b.endDate)} · {formatPrice(b.totalFcfa)}
            </p>
            <p className="muted small">{b.listing.sellerId === user.id ? "Vous louez ce véhicule" : "Vous êtes locataire"}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
