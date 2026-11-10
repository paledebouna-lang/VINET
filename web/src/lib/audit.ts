import { prisma } from "./db";

const HOUR_MS = 3_600_000;

/** Records who looked at which vehicles' positions, at most once an hour per person and vehicle. */
export async function logPositionView(actorId: string, avsIds: string[]) {
  if (avsIds.length === 0) return;
  const recent = await prisma.auditLog.findMany({
    where: { action: "position.viewed", actorId, target: { in: avsIds }, at: { gt: new Date(Date.now() - HOUR_MS) } },
    select: { target: true },
  });
  const done = new Set(recent.map((r) => r.target));
  const missing = avsIds.filter((id) => !done.has(id));
  if (missing.length) {
    await prisma.auditLog.createMany({ data: missing.map((target) => ({ action: "position.viewed", actorId, target })) });
  }
}
