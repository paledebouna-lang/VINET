import Link from "next/link";
import { formatNumber, formatPrice, listingTitle } from "@/lib/listing";

export type CardListing = {
  id: string;
  category: string;
  brand: string;
  model: string;
  year: number | null;
  mileageKm: number | null;
  transmission: string | null;
  partName: string | null;
  partCondition: string | null;
  commune: string;
  priceFcfa: number;
  kind: "SALE" | "RENT";
  photos: { id: string }[];
};

// What every list of listings needs: the fields above and the cover photo.
export const cardSelect = {
  id: true,
  category: true,
  partName: true,
  partCondition: true,
  brand: true,
  model: true,
  year: true,
  mileageKm: true,
  transmission: true,
  commune: true,
  priceFcfa: true,
  kind: true,
  photos: { select: { id: true }, orderBy: { position: "asc" }, take: 1 },
} as const;

export function ListingCard({ listing }: { listing: CardListing }) {
  const title = listingTitle(listing);
  return (
    <article className="listing-card">
      <Link href={`/annonces/${listing.id}`}>
        <div className="listing-card-photo">
          {listing.photos[0] && (
            <img src={`/photos/${listing.photos[0].id}?s`} alt="" loading="lazy" width={480} height={360} />
          )}
          <span className={listing.kind === "RENT" ? "badge badge-rent" : "badge"}>
            {listing.kind === "RENT" ? "À louer" : listing.partName ? "Pièce" : "À vendre"}
          </span>
        </div>
        <div className="listing-card-body">
          <h3>{title}</h3>
          <p className="muted">
            {listing.partCondition
              ? `Pièce ${listing.partCondition.toLowerCase()}`
              : `${formatNumber(listing.mileageKm ?? 0)} km · ${listing.transmission}`}
          </p>
          <p className="muted">{listing.commune}, Abidjan</p>
          <p className="price">
            {formatPrice(listing.priceFcfa)}
            {listing.kind === "RENT" && " / jour"}
          </p>
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
