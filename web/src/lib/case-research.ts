import { prisma } from "./db";
import { caseWindowStart, researchRows } from "./security";
import { isLive } from "./tracking";

type Tracked = { id: string; tracker: { id: string; lastSeenAt: Date | null } | null };

/**
 * What the team may consult for an active theft case: positions, scan reports and alerts
 * from one day before the theft. Callers check that the case is active and log the access.
 */
export async function loadResearch(vehicle: Tracked, stolenAt: Date) {
  const from = caseWindowStart(stolenAt);
  const [positions, sightings, alerts] = await Promise.all([
    vehicle.tracker
      ? prisma.position.findMany({
          where: { trackerId: vehicle.tracker.id, recordedAt: { gte: from } },
          orderBy: { recordedAt: "desc" },
          take: 500,
        })
      : [],
    prisma.sighting.findMany({
      where: { vehicleId: vehicle.id, createdAt: { gte: from } },
      orderBy: { createdAt: "desc" },
      include: { reporter: { select: { email: true, phoneNumber: true } } },
    }),
    prisma.alert.findMany({ where: { vehicleId: vehicle.id, createdAt: { gte: from } }, orderBy: { createdAt: "desc" } }),
  ]);
  const live = isLive(vehicle.tracker?.lastSeenAt ?? null);
  return { from, positions, sightings, alerts, live, rows: researchRows(positions[0], live, sightings) };
}
