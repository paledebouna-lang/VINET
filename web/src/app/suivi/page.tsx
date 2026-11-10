import Link from "next/link";
import { connection } from "next/server";
import { type MapPoint, MapLegend, TrackingMap } from "./tracking-map";
import { logPositionView } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { today } from "@/lib/rental";
import { requireUser } from "@/lib/session";
import { ago, isLive } from "@/lib/tracking";

export const instant = false;

/** The fleet at a glance: every tracked vehicle of the signed-in owner. */
export default async function Parc() {
  await connection();
  const user = await requireUser();
  const vehicles = await prisma.vehicle.findMany({
    where: { ownerId: user.id, tracker: { isNot: null } },
    orderBy: { createdAt: "desc" },
    include: {
      tracker: { include: { positions: { orderBy: { recordedAt: "desc" }, take: 1 } } },
      alerts: { where: { acknowledgedAt: null } },
      listings: { include: { bookings: { where: { status: "ACTIVE" } } } },
    },
  });
  await logPositionView(user.id, vehicles.map((v) => v.avsId));
  const rows = vehicles.map((v) => {
    const latest = v.tracker!.positions[0];
    const rental = v.listings.flatMap((l) => l.bookings)[0];
    return {
      id: v.id,
      name: `${v.brand} ${v.model}`,
      latest,
      live: isLive(v.tracker!.lastSeenAt),
      alerts: v.alerts.length,
      rented: !!rental,
      // Shown when the page is opened; nothing is pushed while nobody is looking.
      late: !!rental && rental.endDate < today(),
    };
  });
  const points: MapPoint[] = rows.flatMap((r) =>
    r.latest
      ? [
          {
            latitude: r.latest.latitude,
            longitude: r.latest.longitude,
            kind: r.live ? ("live" as const) : ("last" as const),
            label: `${r.name} · ${r.live ? "en direct" : `dernière position ${ago(r.latest.recordedAt)}`}`,
          },
        ]
      : [],
  );

  return (
    <div className="section wrap">
      <h1 className="page-title">Suivi de mon parc</h1>
      {rows.length === 0 ? (
        <p className="muted">
          Aucun véhicule suivi. Déclarez une balise depuis le passeport d&apos;un de <Link href="/vehicules">vos véhicules</Link>.
        </p>
      ) : (
        <>
          <dl className="specs">
            <div>
              <dt>Véhicules suivis</dt>
              <dd>{rows.length}</dd>
            </div>
            <div>
              <dt>En location</dt>
              <dd>{rows.filter((r) => r.rented).length}</dd>
            </div>
            <div>
              <dt>Alertes à voir</dt>
              <dd>{rows.reduce((n, r) => n + r.alerts, 0)}</dd>
            </div>
            <div>
              <dt>Balises silencieuses</dt>
              <dd>{rows.filter((r) => !r.live).length}</dd>
            </div>
          </dl>
          <TrackingMap points={points} />
          <MapLegend />
          <div className="stack">
            {rows.map((r) => (
              <Link key={r.id} href={`/vehicules/${r.id}/suivi`} className="card conversation">
                <div className="row">
                  <strong>{r.name}</strong>
                  <span className={r.live ? "status status-published" : "status status-pending"}>
                    {!r.latest ? "Aucune position reçue" : r.live ? `En direct · GPS · ${ago(r.latest.recordedAt)}` : `Dernière position · GPS · ${ago(r.latest.recordedAt)}`}
                  </span>
                </div>
                <p className="muted small">
                  {[r.rented ? "En location" : "Disponible", r.late && "retour en retard", r.alerts > 0 && `${r.alerts} alerte${r.alerts > 1 ? "s" : ""} à voir`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
