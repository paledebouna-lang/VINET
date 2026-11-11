/** Pilot indicators: small pure computations over rows the admin page loads. */

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export const dayAgo = (now = new Date()) => new Date(now.getTime() - DAY_MS);

/** The start of the measured period: `?depuis=YYYY-MM-DD`, or 90 days ago. */
export function periodStart(param: string | string[] | undefined, now = new Date()) {
  const parsed = typeof param === "string" && /^\d{4}-\d{2}-\d{2}$/.test(param) ? new Date(`${param}T00:00:00Z`) : null;
  return parsed && !Number.isNaN(parsed.getTime()) && parsed <= now ? parsed : new Date(now.getTime() - 90 * DAY_MS);
}

export function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function formatDuration(ms: number | null) {
  if (ms === null) return "Pas encore de donnée";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ${String(minutes % 60).padStart(2, "0")}`;
  return `${Math.floor(hours / 24)} j ${hours % 24} h`;
}

export const percent = (part: number, whole: number) => (whole ? `${Math.round((100 * part) / whole)} %` : "Pas encore de donnée");

type Thread = { buyerId: string; createdAt: Date; messages: { senderId: string; createdAt: Date }[] };

/**
 * Conversations whose seller answered the buyer's first message within 24 hours. Conversations
 * opened less than 24 hours ago and still unanswered are left out: they may yet be answered in time.
 */
export function answeredWithinADay(threads: Thread[], now = new Date()) {
  let answered = 0;
  let eligible = 0;
  for (const t of threads) {
    const first = t.messages.find((m) => m.senderId === t.buyerId);
    if (!first) continue;
    const reply = t.messages.find((m) => m.senderId !== t.buyerId && m.createdAt >= first.createdAt);
    const inTime = reply && reply.createdAt.getTime() - first.createdAt.getTime() <= DAY_MS;
    if (!inTime && now.getTime() - first.createdAt.getTime() < DAY_MS) continue;
    eligible++;
    if (inTime) answered++;
  }
  return { answered, eligible };
}

type View = { actorId: string; target: string; at: Date };
type CaseSpan = { avsId: string; decidedAt: Date | null; closedAt: Date | null; status: string };

/**
 * Team views of positions that no confirmed theft case covered. The site is built so that this stays
 * at zero; a count above zero means something to investigate. An admin looking at their own vehicle is not counted.
 */
export function viewsOutsideCases(views: View[], cases: CaseSpan[], ownerOf: Map<string, string>) {
  return views.filter((v) => {
    if (ownerOf.get(v.target) === v.actorId) return false;
    return !cases.some(
      (c) =>
        c.avsId === v.target &&
        c.status !== "REJECTED" &&
        c.decidedAt !== null &&
        c.decidedAt <= v.at &&
        (c.closedAt === null || v.at <= c.closedAt),
    );
  }).length;
}
