import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { siteUrl } from "@/lib/mail";
import { caseReference } from "@/lib/security";
import { notifyTeam } from "@/lib/team";
import { RETENTION_DAYS, plausible } from "@/lib/tracking";
import { detectionsPayload, openKey, resolveEid } from "@/lib/vinet";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MAX_PER_HOUR = 5000;
const json = (body: object, status: number) => Response.json(body, { status });

/**
 * Where partner detectors send the VINET identifiers they hear.
 * Authentication: `Authorization: Bearer <detector key>`. Body: { detections: [{ time, eid, lat, lng, accuracy?, rssi? }] }.
 * Identifiers that belong to no registered beacon are dropped without a trace: MonAuto keeps
 * nothing about devices that are not its own.
 */
export async function POST(request: Request) {
  const key = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!key) return json({ error: "missing detector key" }, 401);
  const detector = await prisma.detector.findUnique({ where: { keyHash: createHash("sha256").update(key).digest("hex") } });
  if (!detector || detector.revokedAt) return json({ error: "unknown detector key" }, 401);

  const parsed = detectionsPayload.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid payload" }, 400);
  // A detector flooding the service is stopped before any work is done.
  const lastHour = await prisma.detection.count({ where: { detectorId: detector.id, receivedAt: { gt: new Date(Date.now() - HOUR_MS) } } });
  if (lastHour + parsed.data.detections.length > MAX_PER_HOUR) return json({ error: "too many detections" }, 429);

  const beacons = (await prisma.beacon.findMany()).map((b) => ({ ...b, identityKey: openKey(b.sealedKey) }));
  const resolved = plausible(parsed.data.detections).flatMap((d) => {
    const beaconId = resolveEid(d.eid, d.time, beacons);
    return beaconId ? [{ ...d, beaconId }] : [];
  });

  const { count } = await prisma.detection.createMany({
    data: resolved.map((d) => ({
      beaconId: d.beaconId,
      detectorId: detector.id,
      detectedAt: d.time,
      latitude: d.lat,
      longitude: d.lng,
      accuracyM: d.accuracy === undefined ? null : Math.round(d.accuracy),
      rssi: d.rssi ?? null,
    })),
    skipDuplicates: true,
  });
  await prisma.detector.update({ where: { id: detector.id }, data: { lastSeenAt: new Date() } });

  // Latest detection per beacon; the team hears about a stolen vehicle at most once an hour.
  const latest = new Map<string, Date>();
  for (const d of resolved) if (!(d.time <= (latest.get(d.beaconId) ?? new Date(0)))) latest.set(d.beaconId, d.time);
  for (const [beaconId, time] of latest) {
    const at = new Date(Math.min(time.getTime(), Date.now()));
    const beacon = beacons.find((b) => b.id === beaconId)!;
    if (beacon.lastDetectedAt && beacon.lastDetectedAt >= at) continue;
    await prisma.beacon.update({ where: { id: beaconId }, data: { lastDetectedAt: at } });
    const active = await prisma.theftCase.findFirst({ where: { vehicleId: beacon.vehicleId, status: "ACTIVE" } });
    if (active && (!beacon.lastDetectedAt || at.getTime() - beacon.lastDetectedAt.getTime() > HOUR_MS)) {
      await notifyTeam(`${caseReference(active.number)} : véhicule détecté par VINET`, `${siteUrl}/admin/dossiers/${active.id}`);
    }
  }

  // shortcut: retention applied on reception, as for GPS positions; move to a scheduled job at launch.
  await prisma.detection.deleteMany({ where: { detectedAt: { lt: new Date(Date.now() - RETENTION_DAYS * DAY_MS) } } });
  return json({ received: parsed.data.detections.length, stored: count }, 200);
}
