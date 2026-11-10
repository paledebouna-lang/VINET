import Link from "next/link";
import { notFound } from "next/navigation";
import { toggleFavorite } from "../../actions";
import { prisma } from "@/lib/db";
import { CATEGORIES, formatNumber, formatPrice, maskVin } from "@/lib/listing";
import { getUser } from "@/lib/session";
import { InquiryForm, ReportForm } from "./forms";

export const instant = false;

export default async function Annonce({ params }: PageProps<"/annonces/[id]">) {
  const { id } = await params;
  const user = await getUser();
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: {
      photos: { orderBy: { position: "asc" } },
      seller: { select: { phoneNumberVerified: true } },
      favorites: { where: { userId: user?.id ?? "" } },
    },
  });
  const isOwner = user?.id === listing?.sellerId;
  // Unpublished listings exist only for their seller and for admins.
  if (!listing || (listing.status !== "PUBLISHED" && !isOwner && user?.role !== "admin")) notFound();

  const title = `${listing.brand} ${listing.model} ${listing.year}`;
  const isFavorite = listing.favorites.length > 0;

  return (
    <div className="section wrap">
      {listing.status !== "PUBLISHED" && (
        <p className="alert">Aperçu : cette annonce n&apos;est pas en ligne.</p>
      )}
      <div className="gallery" tabIndex={0} aria-label={`Photos, ${listing.photos.length} au total`}>
        {listing.photos.map((photo, i) => (
          <img key={photo.id} src={`/photos/${photo.id}`} alt={`${title}, photo ${i + 1}`} loading={i ? "lazy" : "eager"} />
        ))}
      </div>

      <div className="detail">
        <div className="stack">
          <div>
            <h1 className="page-title">{title}</h1>
            <p className="muted">{listing.commune}, Abidjan · localisation approximative</p>
            <p className="price big">{formatPrice(listing.priceFcfa)}</p>
          </div>
          <dl className="specs">
            <div>
              <dt>Catégorie</dt>
              <dd>{CATEGORIES[listing.category]}</dd>
            </div>
            <div>
              <dt>Kilométrage</dt>
              <dd>{formatNumber(listing.mileageKm)} km</dd>
            </div>
            <div>
              <dt>Énergie</dt>
              <dd>{listing.fuel}</dd>
            </div>
            <div>
              <dt>Boîte</dt>
              <dd>{listing.transmission}</dd>
            </div>
            {listing.vin && (
              <div>
                <dt>Numéro de série</dt>
                <dd>{maskVin(listing.vin)}</dd>
              </div>
            )}
          </dl>
          <p className="description">{listing.description}</p>
          <p className="muted small">
            Le transfert de propriété se fait selon la procédure officielle. MonAuto met en relation vendeur et
            acheteur et ne le remplace pas.
          </p>
        </div>

        <aside className="card stack">
          <p className="muted small">
            {listing.seller.phoneNumberVerified ? "Vendeur au numéro de téléphone vérifié." : "Vendeur inscrit par e-mail."}
          </p>
          {isOwner ? (
            <Link href="/mes-annonces" className="btn btn-ghost">
              Gérer mon annonce
            </Link>
          ) : listing.status !== "PUBLISHED" ? null : user ? (
            <>
              <InquiryForm listingId={listing.id} />
              <form action={toggleFavorite}>
                <input type="hidden" name="listingId" value={listing.id} />
                <button className="btn btn-ghost full" aria-pressed={isFavorite}>
                  {isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                </button>
              </form>
              <ReportForm listingId={listing.id} />
            </>
          ) : (
            <Link href="/connexion" className="btn btn-primary">
              Se connecter pour contacter le vendeur
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}
