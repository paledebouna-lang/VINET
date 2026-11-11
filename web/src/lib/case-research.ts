import { prisma } from "./db";
import { caseWindowStart, researchRows } from "./security";
import { isLive } from "./tracking";
import { lastDetection } from "./vinet";

type Tracked = { id: string; tracker: { id: string; lastSeenAt: Date | null } | null; beacon: { id: string } | null };

/**
 * What the team may consult for an active theft case: positions, scan reports and alerts
 * from one day before the theft. Callers check that the case is active and log the access.
 */
export async function loadResearch(vehicle: Tracked, stolenAt: Date) {
  const from = caseWindowStart(stolenAt);
  const [positions, sightings, alerts, detections] = await Promise.all([
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
    vehicle.beacon
      ? prisma.detection.findMany({
          where: { beaconId: vehicle.beacon.id, detectedAt: { gte: from } },
          orderBy: { detectedAt: "desc" },
          take: 500,
          include: { detector: { select: { name: true } } },
        })
      : [],
  ]);
  const live = isLive(vehicle.tracker?.lastSeenAt ?? null);
  const seen = lastDetection(detections);
  const heard = seen && { ...seen.detection, radiusM: seen.radiusM, quality: seen.quality };
  return { from, positions, sightings, alerts, detections, live, rows: researchRows(positions[0], live, sightings, heard ?? undefined) };
}
