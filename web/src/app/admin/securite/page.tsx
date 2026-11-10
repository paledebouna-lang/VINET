import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { today } from "@/lib/rental";
import { CASE_OUTCOME, caseReference } from "@/lib/security";
import { requireAdmin } from "@/lib/session";
import { ago, liveSince } from "@/lib/tracking";

export const instant = false;

const dateTimeFr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

/** AVS Security Center: what needs the team's attention. Figures only; positions are opened case by case. */
export default async function Securite() {
  await connection();
  await requireAdmin();
  const vehicle = { select: { brand: true, model: true, year: true, avsId: true, verifiedAt: true, tracker: { select: { lastSeenAt: true } } } } as const;
  const [toConfirm, active, closed, trackers, silent, alerts, rentals, late, suspicions] = await Promise.all([
    prisma.theftCase.findMany({ where: { status: "DECLARED" }, orderBy: { createdAt: "asc" }, include: { vehicle } }),
    prisma.theftCase.findMany({ where: { status: "ACTIVE" }, orderBy: { decidedAt: "asc" }, include: { vehicle } }),
    prisma.theftCase.findMany({ where: { status: { in: ["CLOSED", "REJECTED"] } }, orderBy: { createdAt: "desc" }, take: 10, include: { vehicle } }),
    prisma.tracker.count(),
    prisma.tracker.count({ where: { OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: liveSince() } }] } }),
    prisma.alert.count({ where: { acknowledgedAt: null } }),
    prisma.booking.count({ where: { status: "ACTIVE" } }),
    prisma.booking.count({ where: { status: "ACTIVE", endDate: { lt: today() } } }),
    prisma.sighting.count({ where: { kind: "SUSPECT", reviewedAt: null } }),
  ]);
  // Observations received since each active case was declared.
  const seen = await prisma.sighting.groupBy({
    by: ["vehicleId"],
    where: { OR: active.map((c) => ({ vehicleId: c.vehicleId, createdAt: { gte: c.createdAt } })) },
    _count: true,
  });
  const seenCount = new Map(seen.map((s) => [s.vehicleId, s._count]));

  return (
    <div className="section wrap">
      <h1 className="page-title">Centre de sécurité AVS</h1>
      <dl className="specs">
        <div>
          <dt>Déclarations à confirmer</dt>
          <dd>{toConfirm.length}</dd>
        </div>
        <div>
          <dt>Recherches actives</dt>
          <dd>{active.length}</dd>
        </div>
        <div>
          <dt>Véhicules suivis par GPS</dt>
          <dd>{trackers}</dd>
        </div>
        <div>
          <dt>Balises silencieuses</dt>
          <dd>{silent}</dd>
        </div>
        <div>
          <dt>Alertes non vues par leur propriétaire</dt>
          <dd>{alerts}</dd>
        </div>
        <div>
          <dt>Locations en cours</dt>
          <dd>{rentals}</dd>
        </div>
        <div>
          <dt>Retours en retard</dt>
          <dd>{late}</dd>
        </div>
        <div>
          <dt>
            <Link href="/admin/vehicules">Soupçons à examiner</Link>
          </dt>
          <dd>{suspicions}</dd>
        </div>
      </dl>

      <h2 className="sub-title spaced">Déclarations de vol à confirmer ({toConfirm.length})</h2>
      {toConfirm.length === 0 && <p className="muted">Aucune déclaration en attente.</p>}
      <div className="stack">
        {toConfirm.map((c) => (
          <Link key={c.id} href={`/admin/dossiers/${c.id}`} className="card conversation">
            <div className="row">
              <strong>
                {caseReference(c.number)} · {c.vehicle.brand} {c.vehicle.model} {c.vehicle.year}
              </strong>
              <span className="status status-pending">Déclarée {ago(c.createdAt)}</span>
            </div>
            <p className="muted small">
              {c.vehicle.avsId} · passeport {c.vehicle.verifiedAt ? "vérifié" : "non vérifié"}
            </p>
          </Link>
        ))}
      </div>

      <h2 className="sub-title spaced">Recherches actives ({active.length})</h2>
      {active.length === 0 && <p className="muted">Aucun véhicule recherché.</p>}
      <div className="stack">
        {active.map((c) => {
          const lastSeenAt = c.vehicle.tracker?.lastSeenAt;
          return (
            <Link key={c.id} href={`/admin/dossiers/${c.id}`} className="card conversation">
              <div className="row">
                <strong>
                  {caseReference(c.number)} · {c.vehicle.brand} {c.vehicle.model} {c.vehicle.year}
                </strong>
                <span className="status status-rejected">Recherche active</span>
              </div>
              <p className="muted small">
                {c.vehicle.tracker ? (lastSeenAt ? `Balise GPS : dernier signal ${ago(lastSeenAt)}` : "Balise GPS : aucun signal") : "Sans balise GPS"}{" "}
                · {seenCount.get(c.vehicleId) ?? 0} signalement(s) depuis la déclaration
              </p>
            </Link>
          );
        })}
      </div>

      <h2 className="sub-title spaced">Derniers dossiers traités</h2>
      {closed.length === 0 && <p className="muted">Aucun dossier clos.</p>}
      <div className="stack">
        {closed.map((c) => (
          <Link key={c.id} href={`/admin/dossiers/${c.id}`} className="card conversation">
            <div className="row">
              <strong>
                {caseReference(c.number)} · {c.vehicle.brand} {c.vehicle.model} {c.vehicle.year}
              </strong>
              <span className="status">{c.outcome ? CASE_OUTCOME[c.outcome] : "Déclaration refusée"}</span>
            </div>
            <p className="muted small">Déclaré le {dateTimeFr.format(c.createdAt)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
