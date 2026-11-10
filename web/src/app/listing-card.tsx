import Link from "next/link";
import { formatNumber, formatPrice } from "@/lib/listing";

export type CardListing = {
  id: string;
  brand: string;
  model: string;
  year: number;
  mileageKm: number;
  transmission: string;
  commune: string;
  priceFcfa: number;
  photos: { id: string }[];
};

// What every list of listings needs: the fields above and the cover photo.
export const cardSelect = {
  id: true,
  brand: true,
  model: true,
  year: true,
  mileageKm: true,
  transmission: true,
  commune: true,
  priceFcfa: true,
  photos: { select: { id: true }, orderBy: { position: "asc" }, take: 1 },
} as const;

export function ListingCard({ listing }: { listing: CardListing }) {
  const title = `${listing.brand} ${listing.model} ${listing.year}`;
  return (
    <article className="listing-card">
      <Link href={`/annonces/${listing.id}`}>
        {listing.photos[0] && (
          <img src={`/photos/${listing.photos[0].id}?s`} alt="" loading="lazy" width={480} height={360} />
        )}
        <div className="listing-card-body">
          <h3>{title}</h3>
          <p className="muted">
            {formatNumber(listing.mileageKm)} km · {listing.transmission}
          </p>
          <p className="muted">{listing.commune}, Abidjan</p>
          <p className="price">{formatPrice(listing.priceFcfa)}</p>
        </div>
      </Link>
    </article>
  );
}

export function ListingGrid({ listings }: { listings: CardListing[] }) {
  return (
    <div className="grid">
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  );
}
