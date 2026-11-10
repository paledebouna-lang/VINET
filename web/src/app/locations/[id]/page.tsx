import Link from "next/link";
import { notFound } from "next/navigation";
import { cancelBooking, confirmInspection, decideBooking, signContract } from "../../rental-actions";
import { SubmitButton, SubmitForm } from "../../submit-form";
import { InspectionForm } from "../forms";
import { prisma } from "@/lib/db";
import { formatNumber, formatPrice } from "@/lib/listing";
import { BOOKING_STATUS, FUEL_LEVELS, TRACKING_NOTICE, formatDay, isoDay } from "@/lib/rental";
import { requireUser } from "@/lib/session";

export const instant = false;

const dateTimeFr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
const STEPS = ["Demande", "Acceptation", "Contrat signé", "Départ", "Retour et clôture"];
const stepOf = { REQUESTED: 0, ACCEPTED: 1, SIGNED: 2, ACTIVE: 3, CLOSED: 5, DECLINED: -1, CANCELLED: -1 } as const;

type InspectionView = {
  mileageKm: number;
  fuelPercent: number;
  notes: string | null;
  depositDone: boolean;
  createdAt: Date;
  confirmedAt: Date | null;
  documents: { id: string }[];
};

function InspectionCard({ title, deposit, inspection }: { title: string; deposit: string; inspection: InspectionView }) {
  return (
    <div className="stack tight">
      <h3 className="sub-title">{title}</h3>
      <dl className="specs">
        <div>
          <dt>Kilométrage</dt>
          <dd>{formatNumber(inspection.mileageKm)} km</dd>
        </div>
        <div>
          <dt>Carburant ou charge</dt>
          <dd>{FUEL_LEVELS[inspection.fuelPercent as keyof typeof FUEL_LEVELS]}</dd>
        </div>
        <div>
          <dt>{deposit}</dt>
          <dd>{inspection.depositDone ? "Oui" : "Non"}</dd>
        </div>
      </dl>
      {inspection.notes && <p className="description">{inspection.notes}</p>}
      <div className="thumbs">
        {inspection.documents.map((doc, i) => (
          <a key={doc.id} href={`/documents/${doc.id}`} target="_blank">
            <img src={`/documents/${doc.id}?s`} alt={`${title}, photo ${i + 1}, ouvrir en grand`} loading="lazy" />
          </a>
        ))}
      </div>
      <p className="muted small">
        Enregistré le {dateTimeFr.format(inspection.createdAt)} ·{" "}
        {inspection.confirmedAt
          ? `confirmé par le locataire le ${dateTimeFr.format(inspection.confirmedAt)}`
          : "en attente de confirmation du locataire"}
      </p>
    </div>
  );
}

export default async function Location({ params }: PageProps<"/locations/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const booking = await prisma.booking.findFirst({
    // Only the renter and the owner can open a rental.
    where: { id, OR: [{ renterId: user.id }, { listing: { sellerId: user.id } }] },
    include: {
      listing: { select: { id: true, brand: true, model: true, year: true, sellerId: true, kmPerDay: true } },
      documents: { where: { kind: "LICENCE" } },
      inspections: { include: { documents: { orderBy: { position: "asc" } } } },
    },
  });
  if (!booking) notFound();

  const isOwner = booking.listing.sellerId === user.id;
  const { status, listing } = booking;
  const fields = { id };
  const departure = booking.inspections.find((i) => i.phase === "DEPARTURE");
  const back = booking.inspections.find((i) => i.phase === "RETURN");
  const pending = status === "SIGNED" ? departure : status === "ACTIVE" ? back : undefined;
  const mySignature = isOwner ? booking.ownerSignedAt : booking.renterSignedAt;
  const step = stepOf[status];

  // Facts for the closing summary; fees themselves are settled between the two parties.
  const driven = departure && back ? back.mileageKm - departure.mileageKm : null;
  const included = booking.days * (listing.kmPerDay ?? 0);
  const lateDays = back ? Math.max(0, Math.round((Date.parse(isoDay(back.createdAt)) - booking.endDate.getTime()) / 86_400_000)) : 0;

  return (
    <div className="section wrap medium">
      <p>
        <Link href="/locations">Toutes mes locations</Link>
      </p>
      <div className="row">
        <h1 className="page-title">
          <Link href={`/annonces/${listing.id}`}>
            {listing.brand} {listing.model} {listing.year}
          </Link>
        </h1>
        <span className="status">{BOOKING_STATUS[status]}</span>
      </div>
      <p>
        Du {formatDay(booking.startDate)} au {formatDay(booking.endDate)} inclus · {booking.days} jour
        {booking.days > 1 ? "s" : ""} · {formatPrice(booking.totalFcfa)} · dépôt de garantie{" "}
        {formatPrice(booking.depositFcfa)}
      </p>
      <p className="muted small">{isOwner ? "Vous louez ce véhicule." : "Vous êtes le locataire."}</p>

      {step >= 0 && (
        <ol className="steps" aria-label="Étapes de la location">
          {STEPS.map((label, i) => (
            <li key={label} aria-current={i === step ? "step" : undefined} className={i < step ? "done" : undefined}>
              {label}
              <span className="sr-only">{i < step ? " : fait" : i === step ? " : étape en cours" : ""}</span>
            </li>
          ))}
        </ol>
      )}

      {status === "REQUESTED" && (
        <section className="card stack">
          <h2 className="sub-title">Demande de location</h2>
          <dl className="facts">
            <div>
              <dt>Conducteur</dt>
              <dd>{booking.renterFullName}</dd>
            </div>
            <div>
              <dt>Permis de conduire</dt>
              <dd>{booking.licenceNumber}</dd>
            </div>
          </dl>
          {isOwner ? (
            <>
              <div className="thumbs">
                {booking.documents.map((doc) => (
                  <a key={doc.id} href={`/documents/${doc.id}`} target="_blank">
                    <img src={`/documents/${doc.id}?s`} alt="Photo du permis de conduire, ouvrir en grand" />
                  </a>
                ))}
              </div>
              <SubmitForm action={decideBooking} fields={fields} className="row start">
                <SubmitButton name="decision" value="accept">
                  Accepter
                </SubmitButton>
                <SubmitButton name="decision" value="decline" className="btn btn-ghost">
                  Refuser
                </SubmitButton>
              </SubmitForm>
            </>
          ) : (
            <p className="muted">Le loueur n&apos;a pas encore répondu.</p>
          )}
        </section>
      )}

      {booking.contractText && step >= 1 && (
        <section className="card stack">
          <h2 className="sub-title">Contrat de location</h2>
          <pre className="contract">{booking.contractText}</pre>
          <p className="muted small">
            Loueur : {booking.ownerSignedAt ? `signé le ${dateTimeFr.format(booking.ownerSignedAt)}` : "pas encore signé"} ·
            Locataire :{" "}
            {booking.renterSignedAt ? `signé le ${dateTimeFr.format(booking.renterSignedAt)}` : "pas encore signé"}
          </p>
          {status === "ACCEPTED" && !mySignature && (
            <SubmitForm action={signContract} fields={fields}>
              {!isOwner && (
                <>
                  <p className="notice-plain">{TRACKING_NOTICE}</p>
                  <label className="check">
                    <input type="checkbox" name="tracking" required /> J&apos;accepte la géolocalisation du véhicule
                    pendant la location
                  </label>
                </>
              )}
              <label className="check">
                <input type="checkbox" name="agree" required /> J&apos;ai lu ce contrat et je l&apos;accepte
              </label>
              <SubmitButton>Signer le contrat</SubmitButton>
            </SubmitForm>
          )}
          {status === "ACCEPTED" && mySignature && <p className="muted">En attente de la signature de l&apos;autre partie.</p>}
        </section>
      )}

      {(departure || back || status === "SIGNED" || status === "ACTIVE") && (
        <section className="card stack">
          <h2 className="sub-title">États des lieux</h2>
          {departure && <InspectionCard title="Départ" deposit="Dépôt reçu par le loueur" inspection={departure} />}
          {back && <InspectionCard title="Retour" deposit="Dépôt restitué au locataire" inspection={back} />}

          {isOwner && (status === "SIGNED" || status === "ACTIVE") && !pending?.confirmedAt && (
            <>
              <h3 className="sub-title">
                {pending ? "Refaire l'état des lieux" : status === "SIGNED" ? "État des lieux de départ" : "État des lieux de retour"}
              </h3>
              <InspectionForm
                bookingId={id}
                deposit={status === "SIGNED" ? "Dépôt de garantie reçu" : "Dépôt de garantie restitué"}
              />
            </>
          )}
          {!isOwner && pending && !pending.confirmedAt && (
            <SubmitForm action={confirmInspection} fields={fields}>
              <p className="muted small">
                Vérifiez le kilométrage, le carburant et les photos. En cas de désaccord, écrivez-le au loueur dans
                la messagerie avant de confirmer.
              </p>
              <SubmitButton>
                {status === "SIGNED" ? "Je confirme l'état des lieux de départ" : "Je confirme le retour du véhicule"}
              </SubmitButton>
            </SubmitForm>
          )}
          {!isOwner && !pending && (status === "SIGNED" || status === "ACTIVE") && (
            <p className="muted">
              {status === "SIGNED"
                ? "Le loueur enregistre l'état des lieux au moment du départ."
                : "Le loueur enregistre l'état des lieux au retour du véhicule."}
            </p>
          )}
        </section>
      )}

      {status === "CLOSED" && driven !== null && (
        <section className="card stack">
          <h2 className="sub-title">Bilan</h2>
          <dl className="facts">
            <div>
              <dt>Distance parcourue</dt>
              <dd>{formatNumber(driven)} km</dd>
            </div>
            <div>
              <dt>Distance incluse</dt>
              <dd>{formatNumber(included)} km</dd>
            </div>
            <div>
              <dt>Dépassement</dt>
              <dd>{driven > included ? `${formatNumber(driven - included)} km` : "Aucun"}</dd>
            </div>
            <div>
              <dt>Retard</dt>
              <dd>{lateDays ? `${lateDays} jour${lateDays > 1 ? "s" : ""}` : "Aucun"}</dd>
            </div>
          </dl>
        </section>
      )}

      {(status === "REQUESTED" || status === "ACCEPTED" || status === "SIGNED") && (
        <SubmitForm action={cancelBooking} fields={fields}>
          <SubmitButton className="btn btn-ghost">Annuler cette location</SubmitButton>
        </SubmitForm>
      )}
      <p className="muted small">
        Une question ? Écrivez à l&apos;autre partie depuis <Link href={`/annonces/${listing.id}`}>l&apos;annonce</Link> ou
        vos <Link href="/messages">messages</Link>.
      </p>
    </div>
  );
}
