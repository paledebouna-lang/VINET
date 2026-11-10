import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { CATEGORIES, formatNumber } from "@/lib/listing";
import { siteUrl } from "@/lib/mail";
import { formatDay } from "@/lib/rental";
import { requireUser } from "@/lib/session";

export const instant = false;

const dateTimeFr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
const listingStatus = { PENDING: "en attente", PUBLISHED: "en ligne", REJECTED: "refusée", ARCHIVED: "retirée" };

export default async function Passeport({ params }: PageProps<"/vehicules/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const vehicle = await prisma.vehicle.findFirst({
    // The full passport is for the owner and, to check it, an admin.
    where: user.role === "admin" ? { id } : { id, ownerId: user.id },
    include: {
      listings: {
        orderBy: { createdAt: "desc" },
        include: {
          bookings: {
            where: { inspections: { some: {} } },
            orderBy: { startDate: "desc" },
            include: { inspections: { orderBy: { createdAt: "asc" } } },
          },
        },
      },
      // Observations only: a suspicion may concern the owner, so it stays with the team.
      sightings: { where: { kind: "OBSERVATION" }, orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!vehicle) notFound();

  const checkUrl = `${siteUrl}/v/${vehicle.avsId}`;
  const qr = await QRCode.toDataURL(checkUrl, { margin: 1, width: 320, errorCorrectionLevel: "M" });
  const inspections = vehicle.listings.flatMap((l) => l.bookings.flatMap((b) => b.inspections));

  return (
    <div className="section wrap medium">
      <p className="no-print">
        <Link href="/vehicules">Tous mes véhicules</Link>
      </p>
      <div className="row no-print">
        <h1 className="page-title">
          {vehicle.brand} {vehicle.model} {vehicle.year}
        </h1>
        <span className={vehicle.verifiedAt ? "status status-published" : "status status-pending"}>
          {vehicle.verifiedAt ? "Passeport vérifié" : "Vérification en cours"}
        </span>
      </div>

      <section className="card stack no-print">
        <h2 className="sub-title">Identité</h2>
        <dl className="specs">
          <div>
            <dt>Identifiant AVS</dt>
            <dd className="mono">{vehicle.avsId}</dd>
          </div>
          <div>
            <dt>Catégorie</dt>
            <dd>{CATEGORIES[vehicle.category]}</dd>
          </div>
          <div>
            <dt>Couleur</dt>
            <dd>{vehicle.color}</dd>
          </div>
          <div>
            <dt>Numéro de série</dt>
            <dd className="mono">{vehicle.serial}</dd>
          </div>
          <div>
            <dt>Immatriculation</dt>
            <dd>{vehicle.plate ?? "Non renseignée"}</dd>
          </div>
        </dl>
        <p className="muted small">
          Le passeport AVS ne remplace ni la carte grise, ni le titre de propriété, ni l&apos;assurance.
        </p>
      </section>

      <section className="card stack">
        <h2 className="sub-title no-print">Étiquette QR</h2>
        <div className="qr-label">
          <img src={qr} alt={`QR code du passeport ${vehicle.avsId}`} width={160} height={160} />
          <div>
            <p className="qr-brand">MonAuto · AVS</p>
            <p className="mono">{vehicle.avsId}</p>
            <p className="small">Scannez pour vérifier ce véhicule ou le signaler.</p>
          </div>
        </div>
        <p className="muted small no-print">
          Imprimez cette page puis collez l&apos;étiquette à l&apos;intérieur du pare-brise. Le QR identifie le
          véhicule et permet de le signaler ; il ne le localise pas. Page de vérification :{" "}
          <Link href={`/v/${vehicle.avsId}`}>{checkUrl}</Link>
        </p>
      </section>

      {vehicle.ownerId === user.id && (
        <section className="card stack no-print">
          <h2 className="sub-title">Suivi GPS</h2>
          <p className="muted small">
            Avec une balise GPS, suivez ce véhicule sur la carte et recevez une alerte s&apos;il sort de la zone que
            vous autorisez.
          </p>
          <Link href={`/vehicules/${vehicle.id}/suivi`} className="btn btn-ghost">
            Ouvrir le suivi et la balise
          </Link>
        </section>
      )}

      <section className="card stack no-print">
        <h2 className="sub-title">Historique</h2>
        <h3 className="sub-title">Annonces</h3>
        {vehicle.listings.length === 0 && <p className="muted">Aucune annonce rattachée à ce passeport.</p>}
        <ul className="plain">
          {vehicle.listings.map((l) => (
            <li key={l.id}>
              <Link href={`/annonces/${l.id}`}>{l.kind === "RENT" ? "Location" : "Vente"}</Link>, {listingStatus[l.status]},
              déposée le {formatDay(l.createdAt)}
            </li>
          ))}
        </ul>
        <h3 className="sub-title">États des lieux</h3>
        {inspections.length === 0 && <p className="muted">Aucun état des lieux enregistré.</p>}
        <ul className="plain">
          {inspections.map((i) => (
            <li key={i.id}>
              {dateTimeFr.format(i.createdAt)} · {i.phase === "DEPARTURE" ? "départ" : "retour"} de location ·{" "}
              {formatNumber(i.mileageKm)} km
            </li>
          ))}
        </ul>
      </section>

      <section className="card stack no-print">
        <h2 className="sub-title">Observations après un scan</h2>
        {vehicle.sightings.length === 0 && <p className="muted">Personne n&apos;a encore signalé avoir vu ce véhicule.</p>}
        {vehicle.sightings.map((s) => (
          <div key={s.id} className="message">
            <p>{s.note}</p>
            <p className="muted small">
              {dateTimeFr.format(s.createdAt)}
              {s.latitude !== null && s.longitude !== null && (
                <>
                  {" "}
                  ·{" "}
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${s.latitude}&mlon=${s.longitude}#map=17/${s.latitude}/${s.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    position du téléphone du déclarant, à {s.accuracyM} m près
                  </a>
                </>
              )}
            </p>
          </div>
        ))}
        <p className="muted small">
          Une observation indique où se trouvait le téléphone de la personne qui a scanné le QR, à cet instant. Ce
          n&apos;est pas une position certifiée du véhicule. Ne tentez jamais de récupérer un véhicule vous-même.
        </p>
      </section>
    </div>
  );
}
