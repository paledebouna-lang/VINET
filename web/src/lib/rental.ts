import { z } from "zod";
import { formatPrice } from "./listing.ts";

const DAY_MS = 86_400_000;
export const MAX_RENTAL_DAYS = 90;
export const FUEL_LEVELS = { 0: "Vide", 25: "1/4", 50: "1/2", 75: "3/4", 100: "Plein" } as const;

/** "2026-11-10" → that day at UTC midnight, or null. Abidjan is on UTC all year, so a UTC day is a local day. */
export function parseDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const day = new Date(`${value}T00:00:00Z`);
  // The round trip rejects dates JavaScript would silently roll over, such as 30 February.
  return !Number.isNaN(day.getTime()) && isoDay(day) === value ? day : null;
}

export const isoDay = (day: Date) => day.toISOString().slice(0, 10);
export const today = () => parseDay(isoDay(new Date()))!;

const dateFr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" });
export const formatDay = (day: Date) => dateFr.format(day);

/** Both ends count: 10 to 12 is three days. */
export const rentalDays = (start: Date, end: Date) => Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;

/** Two rentals clash when they share a day; no same-day handover. */
export const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) => aStart <= bEnd && bStart <= aEnd;

const identity = z.object({
  renterFullName: z.string().trim().min(3, "Indiquez vos nom et prénoms.").max(80, "80 caractères au maximum."),
  licenceNumber: z
    .string()
    .trim()
    .min(5, "Indiquez le numéro de votre permis de conduire.")
    .max(30, "30 caractères au maximum."),
});

type Errors = Record<string, string[] | undefined>;

/** Validates a booking request. `now` is injectable for tests. */
export function parseBooking(values: Record<string, string | undefined>, now = today()) {
  const who = identity.safeParse(values);
  const errors: Errors = who.success ? {} : z.flattenError(who.error).fieldErrors;
  const start = parseDay(values.startDate ?? "");
  const end = parseDay(values.endDate ?? "");
  if (!start || start < now) errors.startDate = ["Choisissez une date de départ à partir d'aujourd'hui."];
  if (!end || (start && end < start)) errors.endDate = ["La date de retour suit la date de départ."];
  else if (start && rentalDays(start, end) > MAX_RENTAL_DAYS) {
    errors.endDate = [`Une location dure ${MAX_RENTAL_DAYS} jours au maximum.`];
  }
  if (!who.success || !start || !end || errors.startDate || errors.endDate) return { errors };
  return { data: { ...who.data, startDate: start, endDate: end, days: rentalDays(start, end) } };
}

export const inspectionInput = z.object({
  mileageKm: z
    .string()
    .transform((s) => s.replace(/\s/g, ""))
    .pipe(z.string().regex(/^\d{1,7}$/, "Entrez le kilométrage affiché au compteur."))
    .transform(Number),
  fuelPercent: z.enum(["0", "25", "50", "75", "100"], "Choisissez le niveau de carburant.").transform(Number),
  notes: z
    .string()
    .trim()
    .max(1000, "1000 caractères au maximum.")
    .transform((v) => v || null),
});

type ContractFacts = {
  ownerName: string;
  renterName: string;
  licenceNumber: string;
  vehicle: string;
  startDate: Date;
  endDate: Date;
  days: number;
  pricePerDayFcfa: number;
  totalFcfa: number;
  depositFcfa: number;
  kmPerDay: number;
  zone: string;
};

/**
 * The rental contract both sides sign. A first version to be amended by the lawyer:
 * it states only what the platform knows and does today (no online payment, no fee scale).
 */
export function contractText(c: ContractFacts) {
  return [
    "CONTRAT DE LOCATION DE VÉHICULE",
    "Conclu par l'intermédiaire de MonAuto entre :",
    `Le loueur : ${c.ownerName}`,
    `Le locataire : ${c.renterName}, permis de conduire n° ${c.licenceNumber}`,
    "",
    `1. Véhicule. ${c.vehicle}.`,
    `2. Durée. Du ${formatDay(c.startDate)} au ${formatDay(c.endDate)} inclus, soit ${c.days} jour${c.days > 1 ? "s" : ""}. Le véhicule est restitué au plus tard le dernier jour.`,
    `3. Prix. ${formatPrice(c.pricePerDayFcfa)} par jour, soit ${formatPrice(c.totalFcfa)} au total, réglés par le locataire au loueur au départ du véhicule.`,
    `4. Dépôt de garantie. ${formatPrice(c.depositFcfa)}, remis au loueur au départ et restitué au retour, déduction faite des frais justifiés par l'état des lieux.`,
    `5. Kilométrage et zone. ${c.kmPerDay} km inclus par jour. Le véhicule circule dans la zone suivante : ${c.zone}.`,
    "6. Géolocalisation. Le véhicule est équipé d'un GPS par son propriétaire. Le locataire l'accepte séparément, dans les conditions affichées avant la signature.",
    "7. État des lieux. Le kilométrage, le niveau de carburant et des photos horodatées sont enregistrés sur MonAuto au départ et au retour, puis confirmés par le locataire. Ils font foi entre les parties.",
    "8. Annulation. Chaque partie peut annuler sans frais tant que le véhicule n'est pas parti.",
    "9. Rôle de MonAuto. MonAuto met en relation le loueur et le locataire et conserve la preuve de leurs engagements. MonAuto n'est pas partie au contrat de location.",
    "10. Réclamations. Toute réclamation est d'abord adressée à MonAuto.",
  ].join("\n");
}

export const BOOKING_STATUS = {
  REQUESTED: "En attente de réponse",
  DECLINED: "Refusée",
  ACCEPTED: "Contrat à signer",
  SIGNED: "Départ à enregistrer",
  ACTIVE: "En cours",
  CLOSED: "Clôturée",
  CANCELLED: "Annulée",
} as const;

/** Shown to the renter, and accepted separately, before signing. */
export const TRACKING_NOTICE =
  "Ce véhicule est équipé d'un dispositif de géolocalisation. Pendant la location, du départ enregistré jusqu'à la clôture du retour, sa position est accessible au loueur. Ces données servent uniquement à protéger le véhicule contre le vol, à vérifier le respect de la zone de circulation convenue, à vous porter assistance et à traiter un litige lié à cette location. Le suivi s'arrête à la clôture de la location.";
