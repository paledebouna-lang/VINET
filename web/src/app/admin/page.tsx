import Link from "next/link";
import { resolveReport, verifySeller } from "../actions";
import { prisma } from "@/lib/db";
import { CATEGORIES, formatNumber, formatPrice, matriculeOf } from "@/lib/listing";
import { contactOf, requireAdmin } from "@/lib/session";
import { ModerationForm } from "./moderation-form";

export const instant = false;

export default async function Admin() {
  await requireAdmin();
  const [identities, pending, reports] = await Promise.all([
    prisma.sellerProfile.findMany({
      where: { verifiedAt: null },
      include: { user: { select: { phoneNumber: true, email: true, memberNumber: true } } },
    }),
    prisma.listing.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: {
        photos: { orderBy: { position: "asc" } },
        seller: { select: { phoneNumber: true, email: true, memberNumber: true, sellerProfile: true } },
      },
    }),
    prisma.report.findMany({
      where: { resolvedAt: null },
      orderBy: { createdAt: "asc" },
      include: { listing: { select: { brand: true, model: true, year: true } } },
    }),
  ]);

  return (
    <div className="section wrap medium">
      <h1 className="page-title">Modération</h1>

      <h2 className="sub-title">Identités à vérifier ({identities.length})</h2>
      {identities.length === 0 && <p className="muted">Aucune identité en attente.</p>}
      <div className="stack">
        {identities.map((profile) => (
          <article key={profile.userId} className="card stack">
            <div>
              <h3 className="card-title">{profile.fullName}</h3>
              <p>
                {[
                  profile.company ? [profile.position, profile.company].filter(Boolean).join(", ") : "Particulier",
                  profile.yearsExperience != null && `${profile.yearsExperience} an(s) d'expérience`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {/* Matricule and contact are shown to admins only. */}
              <p className="muted small">
                Matricule : {matriculeOf(profile.user.memberNumber, profile.company)} · Compte :{" "}
                {contactOf(profile.user)}
              </p>
            </div>
            <form action={verifySeller}>
              <input type="hidden" name="userId" value={profile.userId} />
              <button className="btn btn-primary">Identité vérifiée</button>
            </form>
          </article>
        ))}
      </div>

      <h2 className="sub-title spaced">Annonces en attente ({pending.length})</h2>
      {pending.length === 0 && <p className="muted">Aucune annonce à valider.</p>}
      <div className="stack">
        {pending.map((listing) => (
          <article key={listing.id} className="card stack">
            <div>
              <h3 className="card-title">
                {listing.brand} {listing.model} {listing.year}
              </h3>
              <p className="muted">
                {CATEGORIES[listing.category]} · {formatNumber(listing.mileageKm)} km · {listing.fuel} ·{" "}
                {listing.transmission} · {listing.commune} · {formatPrice(listing.priceFcfa)}
              </p>
              {/* The full VIN is shown here only: an admin needs it to check the papers. */}
              <p className="muted small">
                Vendeur : {listing.seller.sellerProfile?.fullName ?? "identité non renseignée"} (
                {listing.seller.sellerProfile?.verifiedAt ? "vérifiée" : "non vérifiée"}) ·{" "}
                {matriculeOf(listing.seller.memberNumber, listing.seller.sellerProfile?.company)} ·{" "}
                {contactOf(listing.seller)} · VIN : {listing.vin ?? "non fourni"}
              </p>
            </div>
            <p className="description">{listing.description}</p>
            <div className="thumbs">
              {listing.photos.map((photo, i) => (
                <a key={photo.id} href={`/photos/${photo.id}`} target="_blank">
                  <img src={`/photos/${photo.id}?s`} alt={`Photo ${i + 1}, ouvrir en grand`} loading="lazy" />
                </a>
              ))}
            </div>
            <ModerationForm id={listing.id} />
          </article>
        ))}
      </div>

      <h2 className="sub-title spaced">Signalements ouverts ({reports.length})</h2>
      {reports.length === 0 && <p className="muted">Aucun signalement.</p>}
      <div className="stack">
        {reports.map((report) => (
          <article key={report.id} className="card stack">
            <p>
              <Link href={`/annonces/${report.listingId}`}>
                {report.listing.brand} {report.listing.model} {report.listing.year}
              </Link>
            </p>
            <p className="description">{report.reason}</p>
            <form action={resolveReport} className="row start">
              <input type="hidden" name="id" value={report.id} />
              <button className="btn btn-primary" name="decision" value="remove">
                Retirer l&apos;annonce
              </button>
              <button className="btn btn-ghost" name="decision" value="dismiss">
                Classer sans suite
              </button>
            </form>
          </article>
        ))}
      </div>
    </div>
  );
}
