import { randomInt } from "node:crypto";
import { z } from "zod";

// No 0/O, 1/I/L: an identifier read from a sticker and typed by hand must not be ambiguous.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const AVS_ID = /^AVS-CI-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/;

/**
 * A new AVS identifier, e.g. AVS-CI-7K2Q-91XM-B4TD. Twelve random characters (about 59 bits):
 * the server issues and stores it, so an identifier it does not know was not issued by MonAuto.
 */
export function newAvsId() {
  const group = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `AVS-CI-${group()}-${group()}-${group()}`;
}

/** The identifier as stored, from what a QR code or a person typed; null when it cannot be one. */
export function parseAvsId(text: string) {
  const id = text.trim().toUpperCase();
  return AVS_ID.test(id) ? id : null;
}

const text = (max: number) =>
  z.string().trim().min(1, "Champ obligatoire.").max(max, `${max} caractères au maximum.`);

export const vehicleInput = z.object({
  category: z.enum(["VOITURE", "MOTO", "UTILITAIRE"], "Choisissez une valeur dans la liste."),
  brand: text(40),
  model: text(60),
  year: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Entrez une année sur quatre chiffres.")
    .transform(Number)
    .pipe(z.number().min(1950, "Année invalide.").max(new Date().getFullYear() + 1, "Année invalide.")),
  color: text(30),
  // VIN (17 characters) or, for older vehicles and motorcycles, a frame number.
  serial: z
    .string()
    .transform((s) => s.replace(/[\s-]/g, "").toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{5,20}$/, "Entre 5 et 20 lettres et chiffres, sans autre signe.")),
  plate: z
    .string()
    .transform((s) => s.replace(/\s+/g, " ").trim().toUpperCase())
    .pipe(z.string().regex(/^([A-Z0-9 -]{4,12})?$/, "Immatriculation invalide."))
    .transform((v) => v || null),
});

/** Public form of a serial number or plate: both ends, so it can be compared with the vehicle. */
export function maskMiddle(value: string, keep = 2) {
  if (value.length <= keep * 2) return "•".repeat(value.length);
  return `${value.slice(0, keep)}${"•".repeat(value.length - keep * 2)}${value.slice(-keep)}`;
}

const coordinate = (min: number, max: number) =>
  z
    .string()
    .regex(/^-?\d{1,3}(\.\d{1,10})?$/)
    .transform(Number)
    .pipe(z.number().min(min).max(max));

export const sightingInput = z.object({
  kind: z.enum(["OBSERVATION", "SUSPECT"], "Choisissez le type de signalement."),
  note: z
    .string()
    .trim()
    .min(10, "Décrivez ce que vous avez vu en 10 caractères au moins.")
    .max(500, "500 caractères au maximum."),
});

// The position is optional as a whole: either a complete, plausible one, or none at all.
const positionInput = z.object({
  latitude: coordinate(-90, 90),
  longitude: coordinate(-180, 180),
  accuracyM: z
    .string()
    .regex(/^\d{1,6}$/)
    .transform(Number),
});

/** The reporter's position if they chose to attach it; null otherwise, or when it is not a real position. */
export function parsePosition(values: Record<string, string | undefined>) {
  if (values.sharePosition !== "on") return null;
  const parsed = positionInput.safeParse(values);
  return parsed.success ? parsed.data : null;
}
