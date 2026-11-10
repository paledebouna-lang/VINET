import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { toggleFavorite } from "../../actions";
import { prisma } from "@/lib/db";
import { CATEGORIES, formatNumber, formatPrice, maskVin } from "@/lib/listing";
import { getUser } from "@/lib/session";
import { BookingForm } from "../../locations/forms";
import { formatDay, isoDay, today } from "@/lib/rental";
import { MessageForm, ReportForm } from "./forms";

export const instant = false;

export default async function Annonce({ params }: PageProps<"/annonces/[id]">) {
  // The page depends on today's date (days already booked), so it is rendered at request time.
  await connection();
  const { id } = await params;
  const user = await getUser();
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: {
      photos: { orderBy: { position: "asc" } },
      seller: { select: { sellerProfile: true } },
      favorites: { where: { userId: user?.id ?? "" } },
      conversations: { where: { buyerId: user?.id ?? "" }, select: { id: true } },
      // Days already taken, shown so that a renter picks free dates.
      bookings: {
        where: { status: { in: ["ACCEPTED", "SIGNED", "ACTIVE"] }, endDate: { gte: today() } },
        orderBy: { startDate: "asc" },
        select: { id: true, startDate: true, endDate: true },
      },
    },
  });
  const isOwner = user?.id === listing?.sellerId;
  // Unpublished listings exist only for their seller and for admins.
  if (!listing || (listing.status !== "PUBLISHED" && !isOwner && user?.role !== "admin")) notFound();

  const title = `${listing.brand} ${listing.model} ${listing.year}`;
  const favorite = listing.favorites[0];
  const conversation = listing.conversations[0];
  const seller = listing.seller.sellerProfile;
  const isRent = listing.kind === "RENT";

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
            <p className="price big">
              {formatPrice(listing.priceFcfa)}
              {isRent && " / jour"}
            </p>
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
            {isRent && (
              <>
                <div>
                  <dt>Dépôt de garantie</dt>
                  <dd>{formatPrice(listing.depositFcfa ?? 0)}</dd>
                </div>
                <div>
                  <dt>Kilomètres inclus</dt>
                  <dd>{listing.kmPerDay} km par jour</dd>
                </div>
                <div>
                  <dt>Zone autorisée</dt>
                  <dd>{listing.zone}</dd>
                </div>
              </>
            )}
            {listing.vin && (
              <div>
                <dt>Numéro de série</dt>
                <dd>{maskVin(listing.vin)}</dd>
              </div>
            )}
          </dl>
          <p className="description">{listing.description}</p>
          {isRent ? (
            <>
              <p className="muted small">
                Ce véhicule est équipé d&apos;un GPS par son propriétaire. Il est géolocalisé pendant la location,
                avec votre accord donné avant la signature du contrat.
              </p>
              {listing.bookings.length > 0 && (
                <div>
                  <h2 className="sub-title">Déjà réservé</h2>
                  <ul className="plain">
                    {listing.bookings.map((b) => (
                      <li key={b.id}>
                        Du {formatDay(b.startDate)} au {formatDay(b.endDate)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="muted small">
              Le transfert de propriété se fait selon la procédure officielle. MonAuto met en relation vendeur et
              acheteur et ne le remplace pas.
            </p>
          )}
        </div>

        <aside className="card stack">
          {/* The seller's public identity: never a phone number or an e-mail. */}
          {seller && (
            <div className="seller">
              <p className="muted small">{isRent ? "Loueur" : "Vendeur"}</p>
              <p className="card-title">{seller.fullName}</p>
              <p>
                {seller.company
                  ? [seller.position, seller.company].filter(Boolean).join(", ")
                  : "Vendeur particulier"}
              </p>
              <p className="muted small">
                {seller.yearsExperience != null &&
                  `${seller.yearsExperience} an${seller.yearsExperience > 1 ? "s" : ""} d'expérience · `}
                {seller.verifiedAt ? "Identité vérifiée par MonAuto" : "Identité en cours de vérification"}
              </p>
            </div>
          )}
          {isOwner ? (
            <>
              <Link href={`/annonces/${listing.id}/modifier`} className="btn btn-primary">
                Modifier mon annonce
              </Link>
              <Link href="/mes-annonces" className="btn btn-ghost">
                Mes annonces
              </Link>
            </>
          ) : listing.status !== "PUBLISHED" ? null : user ? (
            <>
              {isRent && (
                <>
                  <h2 className="sub-title">Réserver ce véhicule</h2>
                  <BookingForm listingId={listing.id} pricePerDay={listing.priceFcfa} today={isoDay(today())} />
                  <hr />
                </>
              )}
              {conversation ? (
                <Link href={`/messages/${conversation.id}`} className={isRent ? "btn btn-ghost" : "btn btn-primary"}>
                  Continuer la conversation
                </Link>
              ) : (
                <MessageForm listingId={listing.id} />
              )}
              <form action={toggleFavorite}>
                <input type="hidden" name="listingId" value={listing.id} />
                <button className="btn btn-ghost full" aria-pressed={!!favorite}>
                  {favorite ? "Retirer des favoris" : "Ajouter aux favoris et suivre le prix"}
                </button>
              </form>
              {favorite && favorite.priceAtSave > listing.priceFcfa && (
                <p className="notice">
                  Prix en baisse de {formatPrice(favorite.priceAtSave - listing.priceFcfa)} depuis votre ajout.
                </p>
              )}
              <ReportForm listingId={listing.id} />
            </>
          ) : (
            <Link href="/connexion" className="btn btn-primary">
              {isRent ? "Se connecter pour louer ce véhicule" : "Se connecter pour écrire au vendeur"}
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}
