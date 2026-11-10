import { z } from "zod";

/** A tracker is "live" when it reported within this window; otherwise the map shows a last known position. */
export const LIVE_WINDOW_MS = 2 * 60_000;
export const MAX_BATCH = 500;
// Device clocks drift; positions are refused when dated further ahead than this, or older than the retention.
const MAX_AHEAD_MS = 5 * 60_000;
export const RETENTION_DAYS = 90;
export const RENTAL_RETENTION_DAYS = 30;

type Point = { latitude: number; longitude: number };
export type Zone = { zoneLat: number; zoneLng: number; zoneRadiusKm: number };

/** Great-circle distance, in kilometres. */
export function distanceKm(a: Point, b: Point) {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export const insideZone = (p: Point, zone: Zone) =>
  distanceKm(p, { latitude: zone.zoneLat, longitude: zone.zoneLng }) <= zone.zoneRadiusKm;

/**
 * The positions, in order, at which something starts: the vehicle leaves the zone, or the tracker
 * loses its power supply. `before` is the state at the last position already stored (null if none).
 * Only a change raises an alert, so a vehicle staying outside does not raise one per position.
 */
export function newAlerts<P extends Point & { powerCut: boolean }>(
  positions: P[],
  zone: Zone | null,
  before: { inside: boolean | null; powerCut: boolean },
) {
  const alerts: { kind: "ZONE_EXIT" | "POWER_CUT"; position: P }[] = [];
  let { inside, powerCut } = before;
  for (const position of positions) {
    const nowInside = zone ? insideZone(position, zone) : null;
    if (inside === true && nowInside === false) alerts.push({ kind: "ZONE_EXIT", position });
    if (!powerCut && position.powerCut) alerts.push({ kind: "POWER_CUT", position });
    inside = nowInside;
    powerCut = position.powerCut;
  }
  return alerts;
}

/** "il y a 12 s", "il y a 5 min", "il y a 3 h", "il y a 2 j". */
export function ago(from: Date, now = new Date()) {
  const s = Math.max(0, Math.round((now.getTime() - from.getTime()) / 1000));
  if (s < 60) return `il y a ${s} s`;
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86_400) return `il y a ${Math.floor(s / 3600)} h`;
  return `il y a ${Math.floor(s / 86_400)} j`;
}

/** Trackers that last reported before this moment count as silent. */
export const liveSince = () => new Date(Date.now() - LIVE_WINDOW_MS);

export const isLive = (lastSeenAt: Date | null, now = new Date()) =>
  lastSeenAt !== null && now.getTime() - lastSeenAt.getTime() <= LIVE_WINDOW_MS;

const position = z.object({
  time: z.iso.datetime({ offset: true }).transform((t) => new Date(t)),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100_000).optional(),
  speed: z.number().min(0).max(400).optional(),
  powerCut: z.boolean().optional(),
});

export const positionsPayload = z.object({ positions: z.array(position).min(1).max(MAX_BATCH) });

/** Keeps the positions whose time is plausible, oldest first. */
export function plausible<P extends { time: Date }>(positions: P[], now = new Date()) {
  const oldest = now.getTime() - RETENTION_DAYS * 86_400_000;
  return positions
    .filter((p) => p.time.getTime() <= now.getTime() + MAX_AHEAD_MS && p.time.getTime() >= oldest)
    .sort((a, b) => a.time.getTime() - b.time.getTime());
}

// Typed by hand, so a decimal comma is accepted; an empty field is an error, not zero.
const typedNumber = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .regex(/^-?\d{1,4}([.,]\d{1,10})?$/, message)
    .transform((s) => Number(s.replace(",", ".")))
    .pipe(z.number().min(min, message).max(max, message));

export const zoneInput = z.object({
  zoneLat: typedNumber(-90, 90, "Latitude invalide."),
  zoneLng: typedNumber(-180, 180, "Longitude invalide."),
  zoneRadiusKm: typedNumber(0.2, 2000, "Le rayon va de 0,2 à 2 000 km."),
});
