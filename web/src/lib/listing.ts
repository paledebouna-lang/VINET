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

/** The public form of a VIN: enough to compare with the papers, not enough to clone them. */
export function maskVin(vin: string) {
  return `${vin.slice(0, 4)}${"•".repeat(9)}${vin.slice(-4)}`;
}

const numberFr = new Intl.NumberFormat("fr-FR");
// Intl groups with narrow no-break spaces; plain spaces read the same and copy cleanly.
export const formatNumber = (n: number) => numberFr.format(n).replace(/\s/g, " ");
export const formatPrice = (fcfa: number) => `${formatNumber(fcfa)} FCFA`;
