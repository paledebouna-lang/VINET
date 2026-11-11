import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { logPositionView } from "@/lib/audit";
import { loadResearch } from "@/lib/case-research";
import { prisma } from "@/lib/db";
import { matriculeOf } from "@/lib/listing";
import { UNDERTAKINGS, caseReference } from "@/lib/security";
import { contactOf, requireAdmin } from "@/lib/session";

export const instant = false;

const dateTimeFr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "medium", timeZone: "UTC" });

/** The file handed to an authority. It exists only for a transmission that has been recorded. */
export default async function Export({ params, searchParams }: PageProps<"/admin/dossiers/[id]/export">) {
  await connection();
  const { id } = await params;
  const { e } = await searchParams;
  const admin = await requireAdmin();
  const theftCase = await prisma.theftCase.findFirst({
    where: { id, status: "ACTIVE" },
    include: {
      vehicle: { include: { tracker: true, beacon: { select: { id: true } } } },
      declarant: { include: { sellerProfile: true } },
      // Working notes stay inside MonAuto: only what the owner said goes out.
      events: { where: { kind: { in: ["OWNER_NOTE", "OWNER_FOUND"] } }, orderBy: { createdAt: "asc" } },
    },
  });
  const transmission =
    theftCase && typeof e === "string"
      ? await prisma.caseEvent.findFirst({ where: { id: e, theftCaseId: id, kind: "EXPORT" }, include: { author: { include: { sellerProfile: true } } } })
      : null;
  if (!theftCase || !transmission) notFound();

  const { vehicle, declarant } = theftCase;
  const research = await loadResearch(vehicle, theftCase.stolenAt);
  await logPositionView(admin.id, [vehicle.avsId]);
  const reference = caseReference(theftCase.number);

  return (
    <div className="section wrap medium stack">
      <p className="no-print">
        <Link href={`/admin/dossiers/${id}`}>Retour au dossier</Link> · Imprimez cette page ou enregistrez-la en PDF
        depuis le menu d&apos;impression de votre navigateur.
      </p>
      <h1 className="page-title">MonAuto · Dossier de vol {reference}</h1>
      <dl className="facts">
        <div>
          <dt>Transmis à</dt>
          <dd>{transmission.text}</dd>
        </div>
        <div>
          <dt>Le</dt>
          <dd>{dateTimeFr.format(transmission.createdAt)} (UTC)</dd>
        </div>
        <div>
          <dt>Par</dt>
          <dd>
            {transmission.author.sellerProfile?.fullName ?? "Équipe MonAuto"} ·{" "}
            {matriculeOf(transmission.author.memberNumber, transmission.author.sellerProfile?.company)}
          </dd>
        </div>
      </dl>

      <h2 className="sub-title">Véhicule</h2>
      <dl className="facts">
        <div>
          <dt>Désignation</dt>
          <dd>
            {vehicle.brand} {vehicle.model} · {vehicle.year} · {vehicle.color}
          </dd>
        </div>
        <div>
          <dt>Numéro de série</dt>
          <dd className="mono">{vehicle.serial}</dd>
        </div>
        <div>
          <dt>Immatriculation</dt>
          <dd>{vehicle.plate ?? "Non renseignée"}</dd>
        </div>
        <div>
          <dt>Identifiant AVS</dt>
          <dd className="mono">{vehicle.avsId}</dd>
        </div>
        <div>
          <dt>Carte grise</dt>
          <dd>{vehicle.verifiedAt ? `Vérifiée par MonAuto le ${dateTimeFr.format(vehicle.verifiedAt)}` : "Non vérifiée"}</dd>
        </div>
        <div>
          <dt>Balise GPS</dt>
          <dd>{vehicle.tracker ? `${vehicle.tracker.model}, n° ${vehicle.tracker.serial}` : "Aucune"}</dd>
        </div>
      </dl>

      <h2 className="sub-title">Déclaration</h2>
      <dl className="facts">
        <div>
          <dt>Déclarant</dt>
          <dd>
            {declarant.sellerProfile?.fullName ?? "Identité non renseignée"} ·{" "}
            {matriculeOf(declarant.memberNumber, declarant.sellerProfile?.company)} · {contactOf(declarant)}
          </dd>
        </div>
        <div>
          <dt>Déposée le</dt>
          <dd>{dateTimeFr.format(theftCase.createdAt)} (UTC)</dd>
        </div>
        <div>
          <dt>Vol constaté le</dt>
          <dd>{dateTimeFr.format(theftCase.stolenAt)} (UTC)</dd>
        </div>
        <div>
          <dt>Lieu</dt>
          <dd>{theftCase.place}</dd>
        </div>
        <div>
          <dt>Plainte</dt>
          <dd>{theftCase.policeReference ?? "Référence non fournie"}</dd>
        </div>
      </dl>
      <p className="description">{theftCase.circumstances}</p>
      {theftCase.events.map((event) => (
        <p key={event.id}>
          {dateTimeFr.format(event.createdAt)} · le propriétaire : {event.text}
        </p>
      ))}
      <p>Engagements acceptés par le déclarant au dépôt :</p>
      <ol>
        {UNDERTAKINGS.map((u) => (
          <li key={u}>{u}</li>
        ))}
      </ol>

      <h2 className="sub-title">Localisation</h2>
      {research.rows.length === 0 ? (
        <p>Aucune position ni aucun signalement depuis le {dateTimeFr.format(research.from)}.</p>
      ) : (
        <div className="table-scroll">
          <table className="compare">
            <thead>
              <tr>
                <th scope="col">Source</th>
                <th scope="col">Date (UTC)</th>
                <th scope="col">Détail</th>
                <th scope="col">Fiabilité</th>
              </tr>
            </thead>
            <tbody>
              {research.rows.map((row) => (
                <tr key={`${row.source}${row.at.toISOString()}`}>
                  <th scope="row">{row.source}</th>
                  <td>{dateTimeFr.format(row.at)}</td>
                  <td className="wrap-anywhere">{row.detail}</td>
                  <td>{row.reliability}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {research.sightings.length > 0 && (
        <p className="small">
          L&apos;identité des auteurs des signalements est conservée par MonAuto et communiquée sur réquisition.
        </p>
      )}
      {research.detections.length > 0 && (
        <>
          <h2 className="sub-title">Détections VINET ({research.detections.length})</h2>
          <div className="table-scroll">
            <table className="compare">
              <thead>
                <tr>
                  <th scope="col">Heure (UTC)</th>
                  <th scope="col">Position du détecteur</th>
                  <th scope="col">Précision du détecteur</th>
                </tr>
              </thead>
              <tbody>
                {research.detections.map((d) => (
                  <tr key={d.id}>
                    <td>{dateTimeFr.format(d.detectedAt)}</td>
                    <td className="mono">
                      {d.latitude.toFixed(5)}, {d.longitude.toFixed(5)}
                    </td>
                    <td>{d.accuracyM !== null ? `± ${d.accuracyM} m` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small">
            Une détection VINET est la position d&apos;un détecteur partenaire qui a capté la balise Bluetooth du
            véhicule : le véhicule se trouvait à quelques dizaines de mètres de ce point.
          </p>
        </>
      )}
      {research.positions.length > 0 && (
        <>
          <h2 className="sub-title">
            Positions GPS depuis le {dateTimeFr.format(research.from)} ({research.positions.length})
          </h2>
          <div className="table-scroll">
            <table className="compare">
              <thead>
                <tr>
                  <th scope="col">Heure (UTC)</th>
                  <th scope="col">Coordonnées</th>
                  <th scope="col">Précision</th>
                  <th scope="col">Vitesse</th>
                </tr>
              </thead>
              <tbody>
                {research.positions.map((p) => (
                  <tr key={p.id}>
                    <td>{dateTimeFr.format(p.recordedAt)}</td>
                    <td className="mono">
                      {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
                    </td>
                    <td>{p.accuracyM !== null ? `± ${p.accuracyM} m` : ""}</td>
                    <td>{p.speedKmh !== null ? `${p.speedKmh} km/h` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="small">
        Une position GPS est celle de la balise à l&apos;heure indiquée ; une observation est celle du téléphone de la
        personne qui a scanné le QR. Document établi à partir des données enregistrées par MonAuto, sans valeur de
        constat officiel.
      </p>
    </div>
  );
}
