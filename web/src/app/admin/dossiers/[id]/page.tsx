import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { addCaseNote, closeCase, decideTheft, exportCase } from "../../../security-actions";
import { SubmitButton, SubmitForm } from "../../../submit-form";
import { type MapPoint, MapLegend, TrackingMap } from "../../../suivi/tracking-map";
import { logPositionView } from "@/lib/audit";
import { loadResearch } from "@/lib/case-research";
import { prisma } from "@/lib/db";
import { matriculeOf } from "@/lib/listing";
import { formatDay } from "@/lib/rental";
import { CASE_OUTCOME, CASE_STATUS, caseReference } from "@/lib/security";
import { contactOf, requireAdmin } from "@/lib/session";

export const instant = false;

const dateTimeFr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "medium", timeZone: "UTC" });
const alertLabels = { ZONE_EXIT: "Alerte : sortie de la zone autorisée", POWER_CUT: "Alerte : alimentation de la balise coupée" };
const eventLabels = {
  NOTE: "Note de l'équipe",
  OWNER_NOTE: "Information du propriétaire",
  OWNER_FOUND: "Propriétaire",
  EXPORT: "Dossier transmis à",
};

export default async function Dossier({ params }: PageProps<"/admin/dossiers/[id]">) {
  await connection();
  const { id } = await params;
  const admin = await requireAdmin();
  const theftCase = await prisma.theftCase.findUnique({
    where: { id },
    include: {
      vehicle: {
        include: {
          tracker: true,
          beacon: { select: { id: true } },
          documents: { where: { kind: "REGISTRATION" } },
          // A rental signed or under way: the renter may be the person who did not bring the vehicle back.
          listings: {
            select: {
              bookings: {
                where: { status: { in: ["SIGNED", "ACTIVE"] } },
                select: { id: true, renterFullName: true, licenceNumber: true, startDate: true, endDate: true },
              },
            },
          },
        },
      },
      declarant: { include: { sellerProfile: true } },
      documents: true,
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!theftCase) notFound();

  const { vehicle, declarant, status } = theftCase;
  const reference = caseReference(theftCase.number);
  const fields = { id };
  // Positions are opened to the team by a confirmed case, and closed again with it.
  const research = status === "ACTIVE" ? await loadResearch(vehicle, theftCase.stolenAt) : null;
  if (research) await logPositionView(admin.id, [vehicle.avsId]);
  const rentals = vehicle.listings.flatMap((l) => l.bookings);

  const points: MapPoint[] = (research?.rows ?? []).flatMap((row) =>
    row.point ? [{ ...row.point, label: `${row.source} · ${dateTimeFr.format(row.at)}` }] : [],
  );
  const timeline = [
    { at: theftCase.createdAt, text: "Déclaration de vol déposée par le propriétaire." },
    ...(theftCase.decidedAt
      ? [
          {
            at: theftCase.decidedAt,
            text: status === "REJECTED" ? `Déclaration refusée : ${theftCase.rejectionReason}` : "Déclaration confirmée : recherche active.",
          },
        ]
      : []),
    ...theftCase.events.map((e) => ({ at: e.createdAt, text: `${eventLabels[e.kind]} : ${e.text}` })),
    ...(research?.sightings ?? []).map((s) => ({
      at: s.createdAt,
      text: `${s.kind === "SUSPECT" ? "Soupçon" : "Observation"} après un scan : ${s.note}`,
    })),
    ...(research?.alerts ?? []).map((a) => ({ at: a.createdAt, text: alertLabels[a.kind] })),
    ...(theftCase.closedAt && theftCase.outcome
      ? [{ at: theftCase.closedAt, text: `Dossier clos : ${CASE_OUTCOME[theftCase.outcome]}. ${theftCase.closingNote ?? ""}` }]
      : []),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  return (
    <div className="section wrap">
      <p>
        <Link href="/admin/securite">Centre de sécurité</Link>
      </p>
      <div className="row">
        <h1 className="page-title">
          Dossier {reference} · {vehicle.brand} {vehicle.model} {vehicle.year}
        </h1>
        <span className={status === "ACTIVE" ? "status status-rejected" : "status status-pending"}>
          {theftCase.outcome ? CASE_OUTCOME[theftCase.outcome] : CASE_STATUS[status]}
        </span>
      </div>

      <section className="card stack">
        <h2 className="sub-title">Déclaration</h2>
        <dl className="facts">
          <div>
            <dt>Déposée le</dt>
            <dd>{dateTimeFr.format(theftCase.createdAt)}</dd>
          </div>
          <div>
            <dt>Vol constaté le</dt>
            <dd>{dateTimeFr.format(theftCase.stolenAt)}</dd>
          </div>
          <div>
            <dt>Lieu</dt>
            <dd>{theftCase.place}</dd>
          </div>
          <div>
            <dt>Plainte</dt>
            <dd>{theftCase.policeReference ?? "Référence non fournie"}</dd>
          </div>
          <div>
            <dt>Déclarant</dt>
            <dd>
              {declarant.sellerProfile?.fullName ?? "Identité non renseignée"} ·{" "}
              {matriculeOf(declarant.memberNumber, declarant.sellerProfile?.company)} · {contactOf(declarant)}
            </dd>
          </div>
        </dl>
        <p className="description">{theftCase.circumstances}</p>
        {theftCase.documents.length > 0 && (
          <div className="thumbs">
            {theftCase.documents.map((doc) => (
              <a key={doc.id} href={`/documents/${doc.id}`} target="_blank">
                <img src={`/documents/${doc.id}?s`} alt="Récépissé de plainte, ouvrir en grand" />
              </a>
            ))}
          </div>
        )}
        <p className="muted small">Le déclarant a accepté les quatre engagements du formulaire au moment du dépôt.</p>
      </section>

      <section className="card stack">
        <h2 className="sub-title">Véhicule</h2>
        <dl className="facts">
          <div>
            <dt>Identifiant AVS</dt>
            <dd className="mono">
              <Link href={`/vehicules/${vehicle.id}`}>{vehicle.avsId}</Link>
            </dd>
          </div>
          <div>
            <dt>Numéro de série</dt>
            <dd className="mono">{vehicle.serial}</dd>
          </div>
          <div>
            <dt>Immatriculation et couleur</dt>
            <dd>
              {vehicle.plate ?? "Non renseignée"} · {vehicle.color}
            </dd>
          </div>
          <div>
            <dt>Passeport</dt>
            <dd>{vehicle.verifiedAt ? "Carte grise vérifiée" : "Carte grise non vérifiée"}</dd>
          </div>
          <div>
            <dt>Balise GPS</dt>
            <dd>{vehicle.tracker ? `${vehicle.tracker.model}, n° ${vehicle.tracker.serial}` : "Aucune"}</dd>
          </div>
        </dl>
        <div className="thumbs">
          {vehicle.documents.map((doc) => (
            <a key={doc.id} href={`/documents/${doc.id}`} target="_blank">
              <img src={`/documents/${doc.id}?s`} alt="Carte grise, ouvrir en grand" />
            </a>
          ))}
        </div>
        {rentals.map((b) => (
          <p key={b.id} className="alert">
            Location en cours : {b.renterFullName}, permis {b.licenceNumber}, du {formatDay(b.startDate)} au{" "}
            {formatDay(b.endDate)}. <Link href={`/locations/${b.id}`}>Contrat et états des lieux</Link>
          </p>
        ))}
      </section>

      {status === "DECLARED" && (
        <section className="card stack">
          <h2 className="sub-title">Décision</h2>
          <p className="muted small">
            Confirmer signale le véhicule comme volé sur sa page de vérification, retire ses annonces et ouvre à
            l&apos;équipe ses positions depuis la veille du vol.
            {!vehicle.verifiedAt && (
              <>
                {" "}
                Le passeport n&apos;est pas vérifié : <Link href="/admin/vehicules">contrôlez d&apos;abord la carte grise</Link>.
              </>
            )}
          </p>
          <SubmitForm action={decideTheft} fields={fields}>
            <div className="field">
              <label htmlFor="reason">Motif, en cas de refus (transmis au déclarant)</label>
              <input id="reason" name="reason" maxLength={500} />
            </div>
            <div className="row start">
              <SubmitButton name="decision" value="confirm">
                Confirmer le vol
              </SubmitButton>
              <SubmitButton name="decision" value="reject" className="btn btn-ghost">
                Refuser la déclaration
              </SubmitButton>
            </div>
          </SubmitForm>
        </section>
      )}

      {research && (
        <>
          <section className="card stack">
            <h2 className="sub-title">Recherche</h2>
            <p className="muted small">
              Sources consultables depuis le {dateTimeFr.format(research.from)}, veille du vol. Chaque consultation est
              journalisée.
            </p>
            {points.length > 0 && (
              <>
                <TrackingMap points={points} path={research.positions.map((p) => [p.latitude, p.longitude])} />
                <MapLegend path={research.positions.length > 1} detection={research.detections.length > 0} />
              </>
            )}
            {research.rows.length === 0 ? (
              <p className="muted">Aucune position ni aucun signalement pour l&apos;instant.</p>
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
              <div>
                <h3 className="sub-title">Auteurs des signalements</h3>
                <ul className="plain">
                  {research.sightings.map((s) => (
                    <li key={s.id}>
                      {dateTimeFr.format(s.createdAt)} · {contactOf(s.reporter)}
                    </li>
                  ))}
                </ul>
                <p className="muted small">Réservé à l&apos;équipe : le propriétaire ne connaît pas leur identité.</p>
              </div>
            )}
            {research.detections.length > 0 && (
              <details>
                <summary>Détections VINET depuis la veille du vol ({research.detections.length})</summary>
                <div className="table-scroll">
                  <table className="compare">
                    <thead>
                      <tr>
                        <th scope="col">Heure (UTC)</th>
                        <th scope="col">Position du détecteur</th>
                        <th scope="col">Précision</th>
                        <th scope="col">Détecteur</th>
                      </tr>
                    </thead>
                    <tbody>
                      {research.detections.slice(0, 50).map((d) => (
                        <tr key={d.id}>
                          <td>{dateTimeFr.format(d.detectedAt)}</td>
                          <td className="mono">
                            {d.latitude.toFixed(5)}, {d.longitude.toFixed(5)}
                          </td>
                          <td>{d.accuracyM !== null ? `± ${d.accuracyM} m` : ""}</td>
                          <td>{d.detector.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
            {research.positions.length > 0 && (
              <details>
                <summary>Positions GPS depuis la veille du vol ({research.positions.length})</summary>
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
                      {research.positions.slice(0, 50).map((p) => (
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
              </details>
            )}
          </section>

          <section className="card stack">
            <h2 className="sub-title">Transmettre le dossier à une autorité</h2>
            <SubmitForm action={exportCase} fields={fields}>
              <div className="field">
                <label htmlFor="recipient">Autorité destinataire et référence de sa demande</label>
                <input id="recipient" name="recipient" required maxLength={200} placeholder="Commissariat du 1er arrondissement, réquisition n° …" />
              </div>
              <SubmitButton className="btn btn-ghost">Enregistrer la transmission et ouvrir le dossier à imprimer</SubmitButton>
            </SubmitForm>
            <p className="muted small">
              La récupération d&apos;un véhicule relève des autorités ou d&apos;intervenants légalement habilités. MonAuto
              leur transmet ce qu&apos;il sait ; il n&apos;intervient pas sur le terrain.
            </p>
          </section>

          <section className="card stack">
            <h2 className="sub-title">Clore le dossier</h2>
            <SubmitForm action={closeCase} fields={fields}>
              <div className="field">
                <label htmlFor="outcome">Issue</label>
                <select id="outcome" name="outcome" required defaultValue="">
                  <option value="" disabled>
                    Choisir
                  </option>
                  {Object.entries(CASE_OUTCOME).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="closing">Résumé de l&apos;issue (transmis au propriétaire)</label>
                <textarea id="closing" name="text" rows={3} required />
              </div>
              <SubmitButton>Clore le dossier</SubmitButton>
            </SubmitForm>
            <p className="muted small">
              À la clôture, le véhicule n&apos;est plus signalé volé et l&apos;équipe n&apos;a plus accès à ses positions. En
              cas de fausse déclaration, suspendez le compte depuis <Link href="/admin/utilisateurs">Utilisateurs</Link>.
            </p>
          </section>
        </>
      )}

      {(status === "DECLARED" || status === "ACTIVE") && (
        <section className="card stack">
          <h2 className="sub-title">Ajouter une note de travail</h2>
          <SubmitForm action={addCaseNote} fields={fields}>
            <div className="field">
              <label htmlFor="note">Note, vue par l&apos;équipe seulement</label>
              <textarea id="note" name="text" rows={3} required />
            </div>
            <SubmitButton className="btn btn-ghost">Ajouter la note</SubmitButton>
          </SubmitForm>
        </section>
      )}

      <section className="card stack">
        <h2 className="sub-title">Chronologie</h2>
        <ol className="timeline">
          {timeline.map((entry, i) => (
            <li key={i}>
              <span className="muted small">{dateTimeFr.format(entry.at)}</span>
              <span className="wrap-anywhere">{entry.text}</span>
            </li>
          ))}
        </ol>
        {(status === "CLOSED" || status === "REJECTED") && (
          <p className="muted small">Dossier fermé : l&apos;accès de l&apos;équipe aux positions du véhicule a pris fin.</p>
        )}
      </section>
    </div>
  );
}
