import { z } from "zod";

const DAY_MS = 86_400_000;

export const caseReference = (number: number) => `VOL-${String(number).padStart(6, "0")}`;

export const CASE_STATUS = {
  DECLARED: "En attente de confirmation",
  ACTIVE: "Recherche active",
  CLOSED: "Clos",
  REJECTED: "Déclaration refusée",
} as const;

export const CASE_OUTCOME = {
  RECOVERED: "Véhicule retrouvé",
  NOT_RECOVERED: "Véhicule non retrouvé",
  FALSE_DECLARATION: "Fausse déclaration",
} as const;

/**
 * What the declarant undertakes when reporting a theft. Shown on the form, each ticked
 * separately, and reproduced in the file sent to an authority.
 */
export const UNDERTAKINGS = [
  "Je déclare être le propriétaire de ce véhicule ou son gestionnaire autorisé, et j'atteste que les informations fournies sont exactes.",
  "J'autorise MonAuto à consulter et à transmettre aux autorités compétentes les positions et les éléments du dossier utiles à la recherche du véhicule.",
  "Je sais qu'une fausse déclaration entraîne la fermeture du dossier et de mon compte, et peut être signalée aux autorités.",
  "Je m'engage à ne pas tenter de récupérer le véhicule moi-même et à ne confronter personne. La récupération relève des autorités ou d'intervenants légalement habilités.",
] as const;

/** "Now" in the form a datetime-local input expects. Abidjan is on UTC all year. */
export const dateTimeLocalNow = () => new Date().toISOString().slice(0, 16);

/** The team may look at positions from one day before the theft: enough to see where the vehicle left from. */
export const caseWindowStart = (stolenAt: Date) => new Date(stolenAt.getTime() - DAY_MS);

const facts = z.object({
  place: z.string().trim().min(3, "Indiquez où le véhicule se trouvait.").max(120, "120 caractères au maximum."),
  circumstances: z
    .string()
    .trim()
    .min(20, "Décrivez les circonstances en 20 caractères au moins.")
    .max(2000, "2000 caractères au maximum."),
  policeReference: z
    .string()
    .trim()
    .max(60, "60 caractères au maximum.")
    .transform((v) => v || null),
});

type Errors = Record<string, string[] | undefined>;

/** Validates a theft declaration. `now` is injectable for tests. */
export function parseTheft(values: Record<string, string | undefined>, now = new Date()) {
  const parsed = facts.safeParse(values);
  const errors: Errors = parsed.success ? {} : z.flattenError(parsed.error).fieldErrors;

  // datetime-local gives "2026-11-10T21:30" with no zone; it is read as UTC, the time in Côte d'Ivoire.
  const raw = values.stolenAt ?? "";
  const stolenAt = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw) ? new Date(`${raw}:00Z`) : null;
  if (!stolenAt || Number.isNaN(stolenAt.getTime())) {
    errors.stolenAt = ["Indiquez la date et l'heure du vol, ou du dernier moment où vous avez vu le véhicule."];
  } else if (stolenAt > now) {
    errors.stolenAt = ["Cette date est dans le futur."];
  } else if (stolenAt.getTime() < now.getTime() - 3650 * DAY_MS) {
    errors.stolenAt = ["Cette date est trop ancienne. Vérifiez l'année."];
  }
  if (UNDERTAKINGS.some((_, i) => values[`u${i}`] !== "on")) {
    errors.undertakings = ["Cochez les quatre engagements pour déclarer le vol."];
  }
  if (!parsed.success || !stolenAt || errors.stolenAt || errors.undertakings) return { errors };
  return { data: { ...parsed.data, stolenAt } };
}

type GpsFix = { recordedAt: Date; latitude: number; longitude: number; accuracyM: number | null };
type Seen = {
  createdAt: Date;
  kind: "OBSERVATION" | "SUSPECT";
  note: string;
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
};

type Heard = { detectedAt: Date; latitude: number; longitude: number; radiusM: number; quality: string };

export type ResearchRow = {
  at: Date;
  source: string;
  detail: string;
  reliability: string;
  // Present when the row can be drawn on the map.
  point?: { latitude: number; longitude: number; kind: "live" | "last" | "observation" | "detection"; radiusM?: number };
};

const coords = (p: { latitude: number; longitude: number }) => `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`;

/**
 * Everything known about where the vehicle is, newest first, each line naming its source and
 * how far it can be trusted. A GPS fix and a passer-by's report never read as the same thing.
 */
export function researchRows(latest: GpsFix | undefined, live: boolean, sightings: Seen[], heard?: Heard): ResearchRow[] {
  const rows: ResearchRow[] = sightings.map((s) => {
    const located = s.latitude !== null && s.longitude !== null;
    return {
      at: s.createdAt,
      source: s.kind === "SUSPECT" ? "Soupçon · QR" : "Observation · QR",
      detail: located
        ? `${s.note} (${coords({ latitude: s.latitude!, longitude: s.longitude! })}, à ${s.accuracyM ?? "?"} m près)`
        : s.note,
      reliability: located ? "À confirmer : position du téléphone du déclarant" : "Faible : sans position",
      point: located ? { latitude: s.latitude!, longitude: s.longitude!, kind: "observation" } : undefined,
    };
  });
  if (latest) {
    rows.push({
      at: latest.recordedAt,
      source: live ? "GPS · en direct" : "GPS · dernière position",
      detail: `${coords(latest)}${latest.accuracyM !== null ? `, ± ${latest.accuracyM} m` : ""}`,
      reliability: live ? "Élevée" : "Moyenne : le véhicule a pu bouger depuis",
      point: { latitude: latest.latitude, longitude: latest.longitude, kind: live ? "live" : "last" },
    });
  }
  if (heard) {
    rows.push({
      at: heard.detectedAt,
      source: "VINET · détection",
      detail: `Dans un rayon de ${heard.radiusM} m autour de ${coords(heard)}`,
      reliability: heard.quality,
      point: { latitude: heard.latitude, longitude: heard.longitude, kind: "detection", radiusM: heard.radiusM },
    });
  }
  return rows.sort((a, b) => b.at.getTime() - a.at.getTime());
}
