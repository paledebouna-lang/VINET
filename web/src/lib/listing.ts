import { z } from "zod";

export const CATEGORIES = {
  VOITURE: "Voiture",
  MOTO: "Moto ou scooter",
  UTILITAIRE: "Utilitaire",
} as const;
export type CategoryKey = keyof typeof CATEGORIES;

export const FUELS = ["Essence", "Diesel", "Hybride", "Électrique"] as const;
export const TRANSMISSIONS = ["Manuelle", "Automatique"] as const;
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

export const listingInput = z.object({
  category: z.enum(["VOITURE", "MOTO", "UTILITAIRE"], choose),
  brand: text(40),
  model: text(60),
  year: int(1950, new Date().getFullYear() + 1, "Année invalide."),
  mileageKm: int(0, 2_000_000, "Kilométrage invalide."),
  fuel: z.enum(FUELS, choose),
  transmission: z.enum(TRANSMISSIONS, choose),
  priceFcfa: int(50_000, 2_000_000_000, "Le prix doit être compris entre 50 000 et 2 000 000 000 FCFA."),
  commune: z.enum(COMMUNES, choose),
  description: z
    .string()
    .trim()
    .min(20, "Décrivez le véhicule en 20 caractères au moins.")
    .max(4000, "4000 caractères au maximum."),
  // 17 characters, never I, O or Q. Optional: an empty field means "not given".
  vin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^([A-HJ-NPR-Z0-9]{17})?$/, "Un numéro de série (VIN) compte 17 caractères, sans I, O ni Q.")
    .transform((v) => v || null),
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
