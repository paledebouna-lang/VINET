import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { isoDay } from "@/lib/rental";
import { answeredWithinADay, dayAgo, formatDuration, median, percent, periodStart, viewsOutsideCases } from "@/lib/pilot";
import { CASE_OUTCOME } from "@/lib/security";
import { requireAdmin } from "@/lib/session";

export const instant = false;

const dateFr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" });
const roleLabels: Record<string, string> = { particulier: "Particuliers", agence: "Agences", admin: "Administrateurs" };
const delays = (pairs: [Date | null, Date | null][]) =>
  median(pairs.flatMap(([a, b]) => (a && b ? [b.getTime() - a.getTime()] : [])));

function Table({ title, rows }: { title: string; rows: [string, string | number][] }) {
  return (
    <section className="card stack">
      <h2 className="sub-title">{title}</h2>
      <div className="table-scroll">
        <table className="compare">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** The pilot's indicators over a period. The targets live in the pilot plan, not here. */
export default async function Pilote({ searchParams }: PageProps<"/admin/pilote">) {
  await connection();
  await requireAdmin();
  const from = periodStart((await searchParams).depuis);
  const since = { gte: from };
  const admins = (await prisma.user.findMany({ where: { role: "admin" }, select: { id: true } })).map((a) => a.id);

  const [agencies, newUsers, published, threads, signed, closed, tickets, verified, trackers, reporting, cases, views, sightings, detections] =
    await Promise.all([
      prisma.user.count({ where: { role: "agence", listings: { some: { status: "PUBLISHED" } } } }),
      prisma.user.groupBy({ by: ["role"], where: { createdAt: since }, _count: true }),
      prisma.listing.findMany({ where: { publishedAt: since }, select: { submittedAt: true, publishedAt: true, kind: true } }),
      prisma.conversation.findMany({
        where: { createdAt: since },
        select: { buyerId: true, createdAt: true, messages: { orderBy: { createdAt: "asc" }, select: { senderId: true, createdAt: true } } },
      }),
      prisma.booking.count({
        where: { ownerSignedAt: { not: null }, renterSignedAt: { not: null }, OR: [{ ownerSignedAt: since }, { renterSignedAt: since }] },
      }),
      prisma.booking.findMany({ where: { status: "CLOSED", closedAt: since }, select: { inspections: { select: { phase: true } } } }),
      prisma.ticket.findMany({ where: { createdAt: since }, select: { createdAt: true, answeredAt: true } }),
      prisma.vehicle.count({ where: { verifiedAt: since } }),
      prisma.tracker.count(),
      prisma.tracker.count({ where: { lastSeenAt: { gt: dayAgo() } } }),
      prisma.theftCase.findMany({ where: { createdAt: since }, select: { status: true, outcome: true, createdAt: true, decidedAt: true } }),
      prisma.auditLog.findMany({ where: { action: "position.viewed", at: since, actorId: { in: admins } }, select: { actorId: true, target: true, at: true } }),
      prisma.sighting.count({ where: { createdAt: since } }),
      prisma.detection.count({ where: { detectedAt: since } }),
    ]);

  // Views are checked against every case of the vehicles viewed, including cases opened before the period.
  const viewed = [...new Set(views.flatMap((v) => (v.target ? [v.target] : [])))];
  const [viewedCases, viewedOwners] = await Promise.all([
    prisma.theftCase.findMany({
      where: { vehicle: { avsId: { in: viewed } } },
      select: { status: true, decidedAt: true, closedAt: true, vehicle: { select: { avsId: true } } },
    }),
    prisma.vehicle.findMany({ where: { avsId: { in: viewed } }, select: { avsId: true, ownerId: true } }),
  ]);
  const outside = viewsOutsideCases(
    views.flatMap((v) => (v.actorId && v.target ? [{ actorId: v.actorId, target: v.target, at: v.at }] : [])),
    viewedCases.map((c) => ({ ...c, avsId: c.vehicle.avsId })),
    new Map(viewedOwners.map((v) => [v.avsId, v.ownerId])),
  );

  const replies = answeredWithinADay(threads);
  const bothInspections = closed.filter((b) => new Set(b.inspections.map((i) => i.phase)).size === 2).length;
  const confirmed = cases.filter((c) => c.status === "ACTIVE" || c.status === "CLOSED");
  const count = (role: string) => newUsers.find((u) => u.role === role)?._count ?? 0;

  return (
    <div className="section wrap medium stack">
      <h1 className="page-title">Indicateurs du pilote</h1>
      <form className="search card">
        <div className="field grow">
          <label htmlFor="depuis">Depuis le</label>
          <input id="depuis" name="depuis" type="date" defaultValue={isoDay(from)} />
        </div>
        <button className="btn btn-primary">Afficher</button>
      </form>
      <p className="muted" role="status">
        Du {dateFr.format(from)} à aujourd&apos;hui. Les cibles sont fixées dans le plan du pilote.
      </p>

      <Table
        title="Activité"
        rows={[
          ["Nouveaux comptes", Object.keys(roleLabels).map((r) => `${roleLabels[r]} : ${count(r)}`).join(", ")],
          ["Agences avec au moins une annonce en ligne (aujourd'hui)", agencies],
          ["Annonces publiées", `${published.length} (${published.filter((l) => l.kind === "RENT").length} en location)`],
          ["Délai médian de modération", formatDuration(delays(published.map((l) => [l.submittedAt, l.publishedAt])))],
          ["Conversations avec réponse du vendeur sous 24 h", `${percent(replies.answered, replies.eligible)} (${replies.answered} sur ${replies.eligible})`],
        ]}
      />
      <Table
        title="Location"
        rows={[
          ["Contrats signés par les deux parties", signed],
          ["Locations terminées", closed.length],
          ["… avec états des lieux de départ et de retour", `${percent(bothInspections, closed.length)} (${bothInspections})`],
        ]}
      />
      <Table
        title="Support"
        rows={[
          ["Demandes reçues", tickets.length],
          ["Sans réponse à ce jour", tickets.filter((t) => !t.answeredAt).length],
          ["Délai médian de première réponse", formatDuration(delays(tickets.map((t) => [t.createdAt, t.answeredAt])))],
        ]}
      />
      <Table
        title="Sécurité"
        rows={[
          ["Passeports vérifiés", verified],
          ["Balises GPS ayant transmis dans les dernières 24 h (aujourd'hui)", `${percent(reporting, trackers)} (${reporting} sur ${trackers})`],
          ["Signalements après scan du QR", sightings],
          ["Détections VINET", detections],
          ["Déclarations de vol", `${cases.length} (${confirmed.length} confirmées, ${cases.filter((c) => c.status === "REJECTED").length} refusées)`],
          ["Délai médian de confirmation d'un vol", formatDuration(delays(confirmed.map((c) => [c.createdAt, c.decidedAt])))],
          [
            "Issues des dossiers clos",
            Object.entries(CASE_OUTCOME)
              .map(([k, label]) => `${label} : ${cases.filter((c) => c.outcome === k).length}`)
              .join(", "),
          ],
          ["Consultations de positions par l'équipe hors dossier confirmé", outside],
        ]}
      />
      {outside > 0 && (
        <p className="alert">
          Des positions ont été consultées par l&apos;équipe hors d&apos;un dossier de vol confirmé : vérifiez le journal
          (action position.viewed).
        </p>
      )}
    </div>
  );
}
