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

export type Rates = { day: number; week: number | null; month: number | null };
type Bill = { total: number; months: number; weeks: number; days: number };

/**
 * The cheapest bill for a rental of `days` days, in whole days, weeks (7 days) and months (30 days).
 * A week or a month may cover a few more days than needed when that costs less: 6 days at a
 * week rate below 6 daily rates is billed as one week. At equal cost, days are kept.
 */
export function rentalPrice(days: number, rates: Rates): Bill {
  const best: Bill[] = [{ total: 0, months: 0, weeks: 0, days: 0 }];
  for (let d = 1; d <= days; d++) {
    const options = [{ ...best[d - 1], total: best[d - 1].total + rates.day, days: best[d - 1].days + 1 }];
    if (rates.week) {
      const before = best[Math.max(0, d - 7)];
      options.push({ ...before, total: before.total + rates.week, weeks: before.weeks + 1 });
    }
    if (rates.month) {
      const before = best[Math.max(0, d - 30)];
      options.push({ ...before, total: before.total + rates.month, months: before.months + 1 });
    }
    best[d] = options.reduce((a, b) => (b.total < a.total ? b : a));
  }
  return best[days];
}

const count = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

/** "1 mois à 500 000 FCFA, 1 semaine à 150 000 FCFA et 2 jours à 30 000 FCFA". */
export function billText(bill: Bill, rates: Rates) {
  const parts = [
    bill.months ? `${count(bill.months, "mois", "mois")} à ${formatPrice(rates.month!)}` : "",
    bill.weeks ? `${count(bill.weeks, "semaine", "semaines")} à ${formatPrice(rates.week!)}` : "",
    bill.days ? `${count(bill.days, "jour", "jours")} à ${formatPrice(rates.day)}` : "",
  ].filter(Boolean);
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} et ${parts.at(-1)}` : parts[0];
}

/** A week or month rate that is not cheaper than the shorter rate would never apply: it is refused. */
export function ratesErrors({ day, week, month }: Rates) {
  const errors: Record<string, string[]> = {};
  if (week !== null && week >= day * 7) {
    errors.pricePerWeekFcfa = ["Le prix à la semaine doit être inférieur à 7 jours au prix par jour."];
  }
  if (month !== null && month >= Math.min(day * 30, week !== null ? week * 5 : Infinity)) {
    errors.pricePerMonthFcfa = [
      "Le prix au mois doit être inférieur à 30 jours au prix par jour, et à 5 semaines au prix à la semaine.",
    ];
  }
  return errors;
}

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
  pricePerWeekFcfa: number | null;
  pricePerMonthFcfa: number | null;
  totalFcfa: number;
  depositFcfa: number;
  kmPerDay: number;
  zone: string;
};

function priceClause(c: ContractFacts) {
  const rates = { day: c.pricePerDayFcfa, week: c.pricePerWeekFcfa, month: c.pricePerMonthFcfa };
  const bill = rentalPrice(c.days, rates);
  // Billed by the day only: the wording of the first contract version, unchanged.
  return bill.weeks || bill.months ? `Tarif appliqué : ${billText(bill, rates)}` : `${formatPrice(c.pricePerDayFcfa)} par jour`;
}

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
    `3. Prix. ${priceClause(c)}, soit ${formatPrice(c.totalFcfa)} au total, réglés par le locataire au loueur au départ du véhicule.`,
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
