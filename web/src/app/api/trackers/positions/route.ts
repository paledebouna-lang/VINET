import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { notify, siteUrl } from "@/lib/mail";
import { RENTAL_RETENTION_DAYS, RETENTION_DAYS, insideZone, newAlerts, plausible, positionsPayload } from "@/lib/tracking";

const DAY_MS = 86_400_000;
const json = (body: object, status: number) => Response.json(body, { status });

/**
 * Where trackers, or the gateway that speaks their protocol, send positions.
 * Authentication: `Authorization: Bearer <device key>`. Body: { positions: [{ time, lat, lng, accuracy?, speed?, powerCut? }] }.
 * A batch is accepted so that a device can send what it stored while out of coverage.
 */
export async function POST(request: Request) {
  const key = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!key) return json({ error: "missing device key" }, 401);
  const tracker = await prisma.tracker.findUnique({
    where: { keyHash: createHash("sha256").update(key).digest("hex") },
    include: { vehicle: { include: { owner: true } } },
  });
  if (!tracker) return json({ error: "unknown device key" }, 401);

  const parsed = positionsPayload.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid payload" }, 400);
  const positions = plausible(parsed.data.positions);
  if (positions.length === 0) return json({ stored: 0 }, 200);

  // State at the newest position already stored: alerts are about what changes after it.
  const last = await prisma.position.findFirst({ where: { trackerId: tracker.id }, orderBy: { recordedAt: "desc" } });
  const { vehicle } = tracker;
  const zone =
    vehicle.zoneLat !== null && vehicle.zoneLng !== null && vehicle.zoneRadiusKm !== null
      ? { zoneLat: vehicle.zoneLat, zoneLng: vehicle.zoneLng, zoneRadiusKm: vehicle.zoneRadiusKm }
      : null;
  const fresh = positions
    .filter((p) => !last || p.time > last.recordedAt)
    .map((p) => ({ latitude: p.lat, longitude: p.lng, powerCut: p.powerCut ?? false, time: p.time }));
  const alerts = newAlerts(fresh, zone, {
    inside: last && zone ? insideZone(last, zone) : null,
    powerCut: last?.powerCut ?? false,
  });

  // Never in the future: a device clock running ahead must not keep a position "live" longer than it is.
  const newest = new Date(Math.min(positions[positions.length - 1].time.getTime(), Date.now()));
  const [{ count }] = await prisma.$transaction([
    prisma.position.createMany({
      data: positions.map((p) => ({
        trackerId: tracker.id,
        recordedAt: p.time,
        latitude: p.lat,
        longitude: p.lng,
        accuracyM: p.accuracy === undefined ? null : Math.round(p.accuracy),
        speedKmh: p.speed === undefined ? null : Math.round(p.speed),
        powerCut: p.powerCut ?? false,
      })),
      skipDuplicates: true,
    }),
    prisma.alert.createMany({
      data: alerts.map((a) => ({
        vehicleId: vehicle.id,
        kind: a.kind,
        latitude: a.position.latitude,
        longitude: a.position.longitude,
        createdAt: a.position.time,
      })),
    }),
    prisma.tracker.update({
      where: { id: tracker.id },
      data: { lastSeenAt: !tracker.lastSeenAt || newest > tracker.lastSeenAt ? newest : tracker.lastSeenAt },
    }),
  ]);

  if (alerts.length) {
    // The owner, and the renter of a rental in progress: the contract says both are told.
    const rental = await prisma.booking.findFirst({
      where: { status: "ACTIVE", listing: { vehicleId: vehicle.id } },
      include: { renter: true },
    });
    const title = `${vehicle.brand} ${vehicle.model}`;
    for (const alert of alerts) {
      const subject =
        alert.kind === "ZONE_EXIT" ? `Alerte : ${title} est sorti de la zone autorisée` : `Alerte : la balise de ${title} a perdu son alimentation`;
      await notify(vehicle.owner.email, subject, `Détail : ${siteUrl}/vehicules/${vehicle.id}/suivi`);
      if (rental && alert.kind === "ZONE_EXIT") {
        await notify(rental.renter.email, `Le véhicule loué est sorti de la zone autorisée`, `Votre location : ${siteUrl}/locations/${rental.id}`);
      }
    }
  }

  // Retention, applied at most once a day per tracker.
  // shortcut: runs when the tracker reports, so a silent tracker keeps its old positions; move to a scheduled job at launch.
  if (!tracker.purgedAt || Date.now() - tracker.purgedAt.getTime() > DAY_MS) {
    const ended = await prisma.booking.findMany({
      where: { listing: { vehicleId: vehicle.id }, closedAt: { lt: new Date(Date.now() - RENTAL_RETENTION_DAYS * DAY_MS) } },
      select: { startDate: true, closedAt: true },
    });
    await prisma.$transaction([
      prisma.position.deleteMany({
        where: { trackerId: tracker.id, recordedAt: { lt: new Date(Date.now() - RETENTION_DAYS * DAY_MS) } },
      }),
      // Positions recorded during a rental, up to its actual return, go 30 days after it closed.
      ...ended.map((b) =>
        prisma.position.deleteMany({
          where: { trackerId: tracker.id, recordedAt: { gte: b.startDate, lte: b.closedAt! } },
        }),
      ),
      prisma.tracker.update({ where: { id: tracker.id }, data: { purgedAt: new Date() } }),
    ]);
  }
  return json({ stored: count, alerts: alerts.length }, 200);
}
