import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { z } from "zod";

/**
 * VINET: Bluetooth beacons that broadcast a rotating identifier (Eddystone-EID, a published
 * Google standard), heard by partner detectors. Only MonAuto holds the key that links an
 * identifier to a vehicle, so a passer-by listening to the beacon cannot follow it.
 */

const SLOT_TOLERANCE = 2;
export const MAX_BATCH = 500;
// shortcut: assumed Bluetooth range, to be replaced by the value measured during field tests.
export const BLE_RANGE_M = 50;
// Detections by different detectors within this time and distance confirm each other.
const CONFIRM_WINDOW_MS = 15 * 60_000;
const CONFIRM_DISTANCE_KM = 1;

function aes128(key: Buffer, block: Buffer) {
  const cipher = createCipheriv("aes-128-ecb", key, null).setAutoPadding(false);
  return Buffer.concat([cipher.update(block), cipher.final()]);
}

/** The 8-byte identifier (hex) a beacon broadcasts when its own clock reads `counter` seconds. */
export function computeEid(identityKey: Buffer, k: number, counter: number) {
  const tkData = Buffer.alloc(16);
  tkData[11] = 0xff;
  tkData.writeUInt16BE(Math.floor(counter / 65536) % 65536, 14);
  const data = Buffer.alloc(16);
  data[11] = k;
  data.writeUInt32BE(Math.floor(counter / 2 ** k) * 2 ** k, 12);
  return aes128(aes128(identityKey, tkData), data).subarray(0, 8).toString("hex");
}

/** The beacon's clock at a given time, from the offset measured at registration. */
export const beaconCounter = (at: Date, clockOffset: number) =>
  (((Math.floor(at.getTime() / 1000) - clockOffset) % 2 ** 32) + 2 ** 32) % 2 ** 32;

type Resolvable = { id: string; identityKey: Buffer; rotationExponent: number; clockOffset: number };

/**
 * Which registered beacon broadcast `eid` at `at`. A few rotation periods either side are
 * accepted, for the drift of the beacon's clock (150 ppm at most, per the standard).
 * shortcut: tries every beacon, fine for a pilot of a few thousand; precompute a table beyond that.
 */
export function resolveEid(eid: string, at: Date, beacons: Resolvable[]) {
  for (const b of beacons) {
    const counter = beaconCounter(at, b.clockOffset);
    for (let d = -SLOT_TOLERANCE; d <= SLOT_TOLERANCE; d++) {
      const c = counter + d * 2 ** b.rotationExponent;
      if (c >= 0 && c < 2 ** 32 && computeEid(b.identityKey, b.rotationExponent, c) === eid) return b.id;
    }
  }
  return null;
}

// The identity key is stored encrypted: a copy of the database alone does not let anyone follow a vehicle.
function secret() {
  const value = process.env.VINET_SECRET;
  if (!value) throw new Error("VINET_SECRET is not set");
  return createHash("sha256").update(value).digest();
}

export function sealKey(identityKey: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret(), iv);
  const sealed = Buffer.concat([cipher.update(identityKey), cipher.final()]);
  return [iv, cipher.getAuthTag(), sealed].map((b) => b.toString("base64url")).join(".");
}

export function openKey(sealed: string) {
  const [iv, tag, data] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", secret(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

export const keyFingerprint = (identityKey: Buffer) => createHash("sha256").update(identityKey).digest("hex");

const hex = (bytes: number, message: string) =>
  z
    .string()
    .transform((s) => s.replace(/[\s:-]/g, "").toLowerCase())
    .pipe(z.string().regex(new RegExp(`^[0-9a-f]{${bytes * 2}}$`), message));

/** What the installer reads from the beacon's configuration tool, at the same moment. */
export const beaconInput = z.object({
  identityKey: hex(16, "La clé d'identité compte 32 caractères hexadécimaux (0-9, a-f)."),
  // From 256 seconds to 9 hours: shorter would make the registration too sensitive to typing delays.
  rotationExponent: z.coerce.number().int().min(8, "Exposant de 8 à 15.").max(15, "Exposant de 8 à 15."),
  counter: z
    .string()
    .trim()
    .regex(/^\d{1,10}$/, "Le compteur de la balise est un nombre de secondes.")
    .transform(Number)
    .pipe(z.number().max(2 ** 32 - 1, "Le compteur de la balise est un nombre de secondes.")),
  eid: hex(8, "L'identifiant diffusé compte 16 caractères hexadécimaux."),
});

const detection = z.object({
  time: z.iso.datetime({ offset: true }).transform((t) => new Date(t)),
  eid: hex(8, "eid"),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(10_000).optional(),
  rssi: z.number().int().min(-127).max(20).optional(),
});
export const detectionsPayload = z.object({ detections: z.array(detection).min(1).max(MAX_BATCH) });

type Seen = { detectedAt: Date; detectorId: string; latitude: number; longitude: number; accuracyM: number | null };

const km = (a: Seen, b: Seen) => {
  const rad = Math.PI / 180;
  const x = (b.longitude - a.longitude) * rad * Math.cos(((a.latitude + b.latitude) / 2) * rad);
  return Math.hypot(x, (b.latitude - a.latitude) * rad) * 6371;
};

/**
 * The last detection, the circle the vehicle is likely in, and how far it can be trusted:
 * a second detector nearby at about the same time confirms it; a single one may be wrong or lying.
 */
export function lastDetection<D extends Seen>(detections: D[]) {
  const latest = detections.reduce<D | undefined>((a, b) => (!a || b.detectedAt > a.detectedAt ? b : a), undefined);
  if (!latest) return null;
  const detectors = new Set(
    detections
      .filter(
        (d) =>
          Math.abs(d.detectedAt.getTime() - latest.detectedAt.getTime()) <= CONFIRM_WINDOW_MS && km(d, latest) <= CONFIRM_DISTANCE_KM,
      )
      .map((d) => d.detectorId),
  );
  return {
    detection: latest,
    radiusM: (latest.accuracyM ?? 0) + BLE_RANGE_M,
    detectors: detectors.size,
    quality: detectors.size > 1 ? `Bonne : ${detectors.size} détecteurs concordants` : "Moyenne : un seul détecteur",
  };
}
