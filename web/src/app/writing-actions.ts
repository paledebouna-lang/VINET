"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { suggestDescription, writingHelpEnabled } from "@/lib/writing-help";

const PER_HOUR = 10;
const PER_DAY = 30;
const FIELDS = ["kind", "category", "brand", "model", "year", "mileageKm", "fuel", "transmission", "commune", "kmPerDay", "zone", "partName", "partCondition", "partReference", "description"];

export type Suggestion = { text?: string; error?: string };

/** Proposes a description from the listing form's current values. The seller edits it before sending. */
export async function proposeDescription(formData: FormData): Promise<Suggestion> {
  const user = await requireUser();
  if (!writingHelpEnabled()) return { error: "L'aide à la rédaction n'est pas disponible." };
  const facts = Object.fromEntries(FIELDS.map((f) => [f, String(formData.get(f) ?? "")]));
  if (!facts.brand.trim() || !facts.model.trim()) return { error: "Indiquez d'abord la marque et le modèle." };

  // Each suggestion is paid for: a limit per account keeps the bill predictable.
  const since = (ms: number) => ({ gt: new Date(Date.now() - ms) });
  const [lastHour, lastDay] = await Promise.all([
    prisma.auditLog.count({ where: { action: "writing.suggested", actorId: user.id, at: since(3_600_000) } }),
    prisma.auditLog.count({ where: { action: "writing.suggested", actorId: user.id, at: since(86_400_000) } }),
  ]);
  if (lastHour >= PER_HOUR || lastDay >= PER_DAY) {
    return { error: "Vous avez beaucoup utilisé l'aide à la rédaction. Réessayez un peu plus tard." };
  }

  await prisma.auditLog.create({ data: { action: "writing.suggested", actorId: user.id } });
  try {
    const text = await suggestDescription(facts);
    return text ? { text } : { error: "Aucune proposition cette fois. Écrivez la description vous-même." };
  } catch (e) {
    console.error("writing help failed", e);
    return { error: "L'aide à la rédaction ne répond pas. Réessayez dans un instant ou écrivez la description vous-même." };
  }
}
