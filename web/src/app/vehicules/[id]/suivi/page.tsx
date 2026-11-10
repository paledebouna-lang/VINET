import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { type MapPoint, MapLegend, TrackingMap } from "../../../suivi/tracking-map";
import { acknowledgeAlert } from "../../../tracking-actions";
import { TrackerForm, ZoneForm } from "./forms";
import { logPositionView } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { siteUrl } from "@/lib/mail";
import { requireUser } from "@/lib/session";
import { ago, isLive } from "@/lib/tracking";

export const instant = false;

const dateTimeFr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "medium", timeZone: "UTC" });
const alertLabels = { ZONE_EXIT: "Sortie de la zone autorisée", POWER_CUT: "Alimentation de la balise coupée" };

export default async function Suivi({ params }: PageProps<"/vehicules/[id]/suivi">) {
  await connection();
  const { id } = await params;
  const user = await requireUser();
  // Positions are for the owner alone: not for a renter, and not for an admin outside a case file.
  const vehicle = await prisma.vehicle.findFirst({
    where: { id, ownerId: user.id },
    include: {
      tracker: { include: { positions: { orderBy: { recordedAt: "desc" }, take: 100 } } },
      alerts: { orderBy: { createdAt: "desc" }, take: 20 },
      sightings: { where: { kind: "OBSERVATION", latitude: { not: null } }, orderBy: { createdAt: "desc" }, take: 10 },
      theftCases: { where: { status: "ACTIVE" }, select: { id: true } },
    },
  });
  if (!vehicle) notFound();

  await logPositionView(user.id, [vehicle.avsId]);

  const { tracker } = vehicle;
  const positions = tracker?.positions ?? [];
  const latest = positions[0];
  const live = isLive(tracker?.lastSeenAt ?? null);
  const hasZone = vehicle.zoneLat !== null && vehicle.zoneLng !== null && vehicle.zoneRadiusKm !== null;

  const points: MapPoint[] = [
    ...vehicle.sightings.map((s) => ({
      latitude: s.latitude!,
      longitude: s.longitude!,
      kind: "observation" as const,
      label: `Observation · QR · ${dateTimeFr.format(s.createdAt)}`,
    })),
    ...(latest
      ? [
          {
            latitude: latest.latitude,
            longitude: latest.longitude,
            kind: live ? ("live" as const) : ("last" as const),
            label: live ? `En direct · GPS · ${ago(latest.recordedAt)}` : `Dernière position · GPS · ${dateTimeFr.format(latest.recordedAt)}`,
          },
        ]
      : []),
  ];

  return (
    <div className="section wrap">
      <p>
        <Link href={`/vehicules/${id}`}>Passeport du véhicule</Link> · <Link href="/suivi">Tout mon parc</Link>
      </p>
      <h1 className="page-title">
        Suivi : {vehicle.brand} {vehicle.model} {vehicle.year}
      </h1>

      {vehicle.theftCases.length > 0 && (
        <p className="alert">
          Ce véhicule est déclaré volé. Ne vous rendez pas sur place et ne confrontez personne : l&apos;équipe MonAuto
          transmet ces positions aux autorités. <Link href={`/vehicules/${id}/vol`}>Ouvrir le dossier</Link>
        </p>
      )}

      {vehicle.alerts.some((a) => !a.acknowledgedAt) && (
        <section className="stack" aria-label="Alertes">
          {vehicle.alerts
            .filter((a) => !a.acknowledgedAt)
            .map((a) => (
              <form key={a.id} action={acknowledgeAlert} className="alert row">
                <input type="hidden" name="id" value={a.id} />
                <span>
                  {alertLabels[a.kind]} · {dateTimeFr.format(a.createdAt)}
                </span>
                <button className="btn btn-ghost">J&apos;ai vu</button>
              </form>
            ))}
        </section>
      )}

      {latest ? (
        <>
          <TrackingMap
            points={points}
            path={positions.map((p) => [p.latitude, p.longitude])}
            zone={hasZone ? { latitude: vehicle.zoneLat!, longitude: vehicle.zoneLng!, radiusKm: vehicle.zoneRadiusKm! } : undefined}
          />
          <MapLegend zone={hasZone} path={positions.length > 1} />
          <section className="card stack">
            <div className="row">
              <h2 className="sub-title">{live ? "Position en direct" : "Dernière position connue"}</h2>
              <span className={live ? "status status-published" : "status status-pending"}>
                {live ? `En direct · GPS · ${ago(latest.recordedAt)}` : `Dernière position · GPS · ${ago(latest.recordedAt)}`}
              </span>
            </div>
            <dl className="specs">
              <div>
                <dt>Source</dt>
                <dd>Balise GPS</dd>
              </div>
              <div>
                <dt>Heure (UTC)</dt>
                <dd>{dateTimeFr.format(latest.recordedAt)}</dd>
              </div>
              <div>
                <dt>Précision</dt>
                <dd>{latest.accuracyM !== null ? `± ${latest.accuracyM} m` : "Non communiquée"}</dd>
              </div>
              <div>
                <dt>Vitesse</dt>
                <dd>{latest.speedKmh !== null ? `${latest.speedKmh} km/h` : "Non communiquée"}</dd>
              </div>
              <div>
                <dt>Coordonnées</dt>
                <dd className="mono">
                  {latest.latitude.toFixed(5)}, {latest.longitude.toFixed(5)}
                </dd>
              </div>
            </dl>
            {!live && (
              <p className="muted small">
                La balise n&apos;a rien transmis depuis plus de deux minutes. Le véhicule a pu se déplacer depuis :
                ce point n&apos;est pas sa position actuelle.
              </p>
            )}
          </section>
        </>
      ) : (
        <p className="muted">{tracker ? "La balise n'a encore transmis aucune position." : "Ce véhicule n'a pas de balise déclarée."}</p>
      )}

      {tracker && (
        <section className="card stack">
          <h2 className="sub-title">Zone autorisée</h2>
          <ZoneForm
            vehicleId={id}
            hasZone={hasZone}
            current={{
              zoneLat: (vehicle.zoneLat ?? latest?.latitude)?.toFixed(5) ?? "",
              zoneLng: (vehicle.zoneLng ?? latest?.longitude)?.toFixed(5) ?? "",
              zoneRadiusKm: vehicle.zoneRadiusKm?.toString() ?? "30",
            }}
          />
        </section>
      )}

      <section className="card stack">
        <h2 className="sub-title">Balise GPS</h2>
        <TrackerForm vehicleId={id} current={tracker ? { model: tracker.model, serial: tracker.serial } : undefined} />
        <p className="muted small">
          La balise, ou la passerelle qui la relie, envoie ses positions à <span className="mono">{siteUrl}/api/trackers/positions</span>{" "}
          avec cette clé.
        </p>
      </section>

      {positions.length > 0 && (
        <section className="card stack">
          <h2 className="sub-title">Historique : {positions.length} dernières positions</h2>
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
                {positions.slice(0, 20).map((p) => (
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
        </section>
      )}
    </div>
  );
}
