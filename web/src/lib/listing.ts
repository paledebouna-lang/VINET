import { z } from "zod";

// What an AVS passport can describe.
export const VEHICLE_CATEGORIES = {
  VOITURE: "Voiture",
  MOTO: "Moto ou scooter",
  UTILITAIRE: "Utilitaire",
} as const;
// What a listing can offer: a vehicle, or a spare part.
export const CATEGORIES = { ...VEHICLE_CATEGORIES, PIECE: "Pièce détachée" } as const;
export type CategoryKey = keyof typeof CATEGORIES;

export const FUELS = ["Essence", "Diesel", "Hybride", "Électrique"] as const;
export const TRANSMISSIONS = ["Manuelle", "Automatique"] as const;
export const PART_CONDITIONS = ["Neuve", "Occasion", "Reconditionnée"] as const;
// The public location of a listing is the commune only, never an address.
export const COMMUNES = [
  "Abobo",
  "Adjamé",
  "Anyama",
  "Attécoubé",
  "Bingerville",
  "Cocody",
  "Koumassi",
  "Marcory",
  "Plateau",
  "Port-Bouët",
  "Songon",
  "Treichville",
  "Yopougon",
] as const;

const choose = "Choisissez une valeur dans la liste.";
const text = (max: number) =>
  z.string().trim().min(1, "Champ obligatoire.").max(max, `${max} caractères au maximum.`);
// People type "48 000": spaces are dropped before the number is read.
const int = (min: number, max: number, message: string) =>
  z
    .string()
    .transform((s) => s.replace(/\s/g, ""))
    .pipe(z.string().regex(/^\d{1,10}$/, "Entrez un nombre entier."))
    .transform(Number)
    .pipe(z.number().min(min, message).max(max, message));

export const KINDS = { SALE: "Vente", RENT: "Location" } as const;
export type KindKey = keyof typeof KINDS;

const SALE_MIN_PRICE = 50_000;

// Fields every listing has.
const listingBase = z.object({
  kind: z.enum(["SALE", "RENT"], choose),
  category: z.enum(["VOITURE", "MOTO", "UTILITAIRE", "PIECE"], choose),
  brand: text(40),
  model: text(60),
  // A sale price or, for a rental, the price per day.
  priceFcfa: int(1_000, 2_000_000_000, "Le prix doit être compris entre 1 000 et 2 000 000 000 FCFA."),
  commune: z.enum(COMMUNES, choose),
  description: z
    .string()
    .trim()
    .min(20, "Décrivez l'annonce en 20 caractères au moins.")
    .max(4000, "4000 caractères au maximum."),
});

const vehicleFields = z.object({
  year: int(1950, new Date().getFullYear() + 1, "Année invalide."),
  mileageKm: int(0, 2_000_000, "Kilométrage invalide."),
  fuel: z.enum(FUELS, choose),
  transmission: z.enum(TRANSMISSIONS, choose),
  // 17 characters, never I, O or Q. Optional: an empty field means "not given".
  vin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^([A-HJ-NPR-Z0-9]{17})?$/, "Un numéro de série (VIN) compte 17 caractères, sans I, O ni Q.")
    .transform((v) => v || null),
});

const partFields = z.object({
  partName: z.string().trim().min(3, "Nommez la pièce : phare avant gauche, alternateur…").max(80, "80 caractères au maximum."),
  partCondition: z.enum(PART_CONDITIONS, choose),
  partReference: z
    .string()
    .trim()
    .toUpperCase()
    .max(40, "40 caractères au maximum.")
    .transform((v) => v || null),
});

const noVehicle = { year: null, mileageKm: null, fuel: null, transmission: null, vin: null };
const noPart = { partName: null, partCondition: null, partReference: null };

type Errors = Record<string, string[] | undefined>;
export type ListingData = z.infer<typeof listingBase> & {
  year: number | null;
  mileageKm: number | null;
  fuel: string | null;
  transmission: string | null;
  vin: string | null;
  partName: string | null;
  partCondition: string | null;
  partReference: string | null;
};

/**
 * Validates the listing form. A vehicle needs its year, mileage, energy and gearbox; a spare part
 * needs its name and condition instead, and is only ever sold.
 */
export function parseListing(values: Record<string, string | undefined>): { data?: ListingData; errors?: Errors } {
  const base = listingBase.safeParse(values);
  const isPart = values.category === "PIECE";
  const part = isPart ? partFields.safeParse(values) : null;
  const vehicle = isPart ? null : vehicleFields.safeParse(values);
  const errors: Errors = {
    ...(base.success ? {} : z.flattenError(base.error).fieldErrors),
    ...(part && !part.success ? z.flattenError(part.error).fieldErrors : {}),
    ...(vehicle && !vehicle.success ? z.flattenError(vehicle.error).fieldErrors : {}),
  };
  if (isPart && values.kind === "RENT") errors.kind = ["Une pièce détachée se vend, elle ne se loue pas."];
  if (!isPart && values.kind === "SALE" && base.success && base.data.priceFcfa < SALE_MIN_PRICE) {
    errors.priceFcfa = ["Un prix de vente commence à 50 000 FCFA."];
  }
  if (!base.success || Object.keys(errors).length) return { errors };
  if (part?.success) return { data: { ...base.data, ...noVehicle, ...part.data } };
  if (vehicle?.success) return { data: { ...base.data, ...noPart, ...vehicle.data } };
  return { errors };
}

// The fields listingTitle needs, for a Prisma select.
export const titleSelect = { category: true, brand: true, model: true, year: true, partName: true } as const;

type Titled = { category: string; brand: string; model: string; year: number | null; partName: string | null };

/** How a listing is named everywhere: "Toyota Corolla 2020", or "Phare avant gauche pour Toyota Corolla". */
export const listingTitle = (l: Titled) =>
  l.category === "PIECE" ? `${l.partName} pour ${l.brand} ${l.model}` : `${l.brand} ${l.model} ${l.year ?? ""}`.trim();

/** What a rental offer adds. Without a declared GPS, a vehicle cannot be put up for rent. */
export const rentalInput = z.object({
  depositFcfa: int(0, 50_000_000, "Dépôt de garantie invalide."),
  kmPerDay: int(1, 2_000, "Entre 1 et 2 000 km par jour."),
  zone: text(80),
  gpsModel: text(60),
  gpsSerial: z.string().trim().min(5, "Indiquez le numéro de série ou l'IMEI du GPS.").max(40, "40 caractères au maximum."),
});

// An empty optional field is stored as null, not as an empty string.
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères au maximum.`)
    .transform((v) => v || null);

export const sellerProfileInput = z.object({
  fullName: z.string().trim().min(3, "Indiquez vos nom et prénoms.").max(80, "80 caractères au maximum."),
  company: optionalText(80),
  position: optionalText(80),
  yearsExperience: z
    .string()
    .trim()
    .regex(/^\d{0,2}$/, "Entrez un nombre d'années.")
    .transform((v) => (v ? Number(v) : null))
    .pipe(z.number().max(60, "60 ans au maximum.").nullable()),
});

/**
 * The matricule MonAuto gives every account: "E" for a seller attached to a company,
 * "P" for a private person. The number never changes; the letter follows the company field.
 */
export const matriculeOf = (memberNumber: number, company: string | null | undefined) =>
  `MA-${company ? "E" : "P"}-${String(memberNumber).padStart(6, "0")}`;

/** "MA-P-000042" → 42, so that the team can look an account up by its matricule. */
export function parseMatricule(text: string) {
  const match = /^MA-[EP]-0*(\d{1,9})$/i.exec(text.trim());
  return match ? Number(match[1]) : null;
}

/**
 * Hides phone numbers and e-mail addresses so that exchanges stay on the site.
 * Phone numbers are recognised by their leading 0 or "+", which prices never have.
 * shortcut: digits spelled out in words get through; add moderation if that becomes common.
 */
export function maskContacts(text: string) {
  return text
    // Ends on letters so that the full stop or comma after an address is left in place.
    .replace(/[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}/g, "[e-mail masqué]")
    .replace(/(?<!\d)(?:(?:\+|00)\d{1,3}[\s.-]?)?0\d(?:[\s.-]?\d){8}(?!\d)/g, "[numéro masqué]")
    .replace(/\+\d(?:[\s.-]?\d){7,14}/g, "[numéro masqué]");
}

/** The public form of a VIN: enough to compare with the papers, not enough to clone them. */
export function maskVin(vin: string) {
  return `${vin.slice(0, 4)}${"•".repeat(9)}${vin.slice(-4)}`;
}

const numberFr = new Intl.NumberFormat("fr-FR");
// Intl groups with narrow no-break spaces; plain spaces read the same and copy cleanly.
export const formatNumber = (n: number) => numberFr.format(n).replace(/\s/g, " ");
export const formatPrice = (fcfa: number) => `${formatNumber(fcfa)} FCFA`;
