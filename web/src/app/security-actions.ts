"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "./actions";
import { prisma } from "@/lib/db";
import { notify, siteUrl } from "@/lib/mail";
import { MAX_PHOTO_BYTES, deletePhotos, storePhotos } from "@/lib/photos";
import { CASE_OUTCOME, caseReference, parseTheft } from "@/lib/security";
import { requireAdmin, requireUser } from "@/lib/session";
import { notifyTeam } from "@/lib/team";

const OPEN = ["DECLARED", "ACTIVE"] as const;
const MAX_PENDING_DECLARATIONS = 3;

const text = (formData: FormData) =>
  Object.fromEntries(
    [...formData].filter((e): e is [string, string] => typeof e[1] === "string" && !e[0].startsWith("$")),
  );
const fail = (message: string): FormState => ({ errors: { form: [message] } });
const audit = (action: string, actorId: string, target: string) =>
  prisma.auditLog.create({ data: { action, actorId, target } });

const note = (min: string) =>
  z.string().trim().min(5, min).max(2000, "2000 caractères au maximum.");

/**
 * The owner reports a theft. Nothing changes in public yet: a member of the team
 * must confirm the declaration first.
 */
export async function declareTheft(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const values = text(formData);
  const vehicle = await prisma.vehicle.findFirst({ where: { id: values.vehicleId, ownerId: user.id } });
  if (!vehicle) return { ...fail("Ce véhicule est introuvable."), values };

  const parsed = parseTheft(values);
  const errors = parsed.errors ?? {};
  const file = formData.get("complaint");
  const complaint = file instanceof File && file.size > 0 ? file : null;
  if (complaint && complaint.size > MAX_PHOTO_BYTES) errors.complaint = ["Le fichier doit peser moins de 8 Mo."];
  if (!parsed.data || errors.complaint) return { errors, values };

  const pending = await prisma.theftCase.count({ where: { declarantId: user.id, status: "DECLARED" } });
  if (pending >= MAX_PENDING_DECLARATIONS) {
    return { ...fail("Vous avez déjà 3 déclarations en attente de confirmation."), values };
  }

  let docIds: string[];
  try {
    docIds = await storePhotos(complaint ? [complaint] : []);
  } catch {
    return { errors: { complaint: ["Image illisible. Utilisez un fichier JPEG, PNG ou WebP."] }, values };
  }
  const data = parsed.data;
  let created;
  try {
    // Serializable: one open case per vehicle, even if the form is sent twice at the same instant.
    created = await prisma.$transaction(
      async (tx) => {
        if (await tx.theftCase.findFirst({ where: { vehicleId: vehicle.id, status: { in: [...OPEN] } } })) return null;
        return tx.theftCase.create({
          data: {
            ...data,
            vehicleId: vehicle.id,
            declarantId: user.id,
            documents: { create: docIds.map((id) => ({ id, kind: "THEFT" as const })) },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (e) {
    await deletePhotos(docIds);
    throw e;
  }
  if (!created) {
    await deletePhotos(docIds);
    return { ...fail("Un dossier est déjà ouvert pour ce véhicule."), values };
  }
  const reference = caseReference(created.number);
  await audit("theft.declared", user.id, reference);
  await notifyTeam(`Déclaration de vol ${reference} à confirmer`, `${siteUrl}/admin/dossiers/${created.id}`);
  revalidatePath("/", "layout");
  redirect(`/vehicules/${vehicle.id}/vol`);
}

/** The owner adds information to an open case, or reports that the vehicle has been found. */
export async function addOwnerNote(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const theftCase = await prisma.theftCase.findFirst({
    where: { id: String(formData.get("id")), declarantId: user.id, status: { in: [...OPEN] } },
  });
  if (!theftCase) return fail("Ce dossier n'est plus ouvert.");
  const reference = caseReference(theftCase.number);

  if (formData.get("found") === "on") {
    // Only the team closes a case: the owner's word is recorded and brought to its attention.
    const already = await prisma.caseEvent.findFirst({ where: { theftCaseId: theftCase.id, kind: "OWNER_FOUND" } });
    if (!already) {
      await prisma.caseEvent.create({
        data: { theftCaseId: theftCase.id, authorId: user.id, kind: "OWNER_FOUND", text: "Le propriétaire signale avoir retrouvé le véhicule." },
      });
      await notifyTeam(`${reference} : le propriétaire signale avoir retrouvé le véhicule`, `${siteUrl}/admin/dossiers/${theftCase.id}`);
    }
  } else {
    const parsed = note("Écrivez l'information à ajouter.").safeParse(formData.get("text"));
    if (!parsed.success) return fail(z.flattenError(parsed.error).formErrors[0]);
    await prisma.caseEvent.create({
      data: { theftCaseId: theftCase.id, authorId: user.id, kind: "OWNER_NOTE", text: parsed.data },
    });
    await notifyTeam(`${reference} : nouvelle information du propriétaire`, `${siteUrl}/admin/dossiers/${theftCase.id}`);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** A member of the team confirms a declaration, which starts the search, or refuses it. */
export async function decideTheft(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const confirm = formData.get("decision") === "confirm";
  const reason = String(formData.get("reason") ?? "").trim();
  const theftCase = await prisma.theftCase.findUnique({ where: { id }, include: { vehicle: true, declarant: true } });
  if (!theftCase || theftCase.status !== "DECLARED") return fail("Cette déclaration a déjà été traitée.");
  const { vehicle } = theftCase;
  // Ownership is established by the registration paper, not by the declaration itself.
  if (confirm && !vehicle.verifiedAt) {
    return fail("Le passeport de ce véhicule n'est pas vérifié. Contrôlez d'abord sa carte grise.");
  }
  if (!confirm && reason.length < 5) return fail("Indiquez au déclarant pourquoi sa déclaration est refusée.");

  const decided = { decidedAt: new Date(), decidedById: admin.id };
  const done = await prisma.$transaction(async (tx) => {
    // The status filter makes two admins deciding at once produce a single decision.
    const { count } = await tx.theftCase.updateMany({
      where: { id, status: "DECLARED" },
      data: confirm ? { ...decided, status: "ACTIVE" } : { ...decided, status: "REJECTED", rejectionReason: reason },
    });
    if (!count) return false;
    // A vehicle declared stolen cannot stay on offer.
    if (confirm) {
      await tx.listing.updateMany({
        where: { vehicleId: vehicle.id, status: { in: ["PUBLISHED", "PENDING"] } },
        data: { status: "ARCHIVED" },
      });
    }
    return true;
  });
  if (!done) return fail("Cette déclaration a déjà été traitée.");

  const reference = caseReference(theftCase.number);
  await audit(confirm ? "theft.confirmed" : "theft.rejected", admin.id, reference);
  await notify(
    theftCase.declarant.email,
    confirm ? `Votre déclaration de vol ${reference} est confirmée` : `Votre déclaration de vol ${reference} n'a pas été retenue`,
    confirm
      ? `Le véhicule est maintenant signalé volé sur sa page de vérification, et vous serez prévenu de chaque observation. Ne tentez pas de le récupérer vous-même.\n\n${siteUrl}/vehicules/${vehicle.id}/vol`
      : `Motif : ${reason}\n\n${siteUrl}/vehicules/${vehicle.id}/vol`,
  );
  revalidatePath("/", "layout");
  return { ok: true };
}

/** A working note, seen by the team only. */
export async function addCaseNote(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const parsed = note("Écrivez la note.").safeParse(formData.get("text"));
  if (!parsed.success) return fail(z.flattenError(parsed.error).formErrors[0]);
  const theftCase = await prisma.theftCase.findFirst({ where: { id, status: { in: [...OPEN] } } });
  if (!theftCase) return fail("Ce dossier n'est plus ouvert.");
  await prisma.caseEvent.create({ data: { theftCaseId: id, authorId: admin.id, kind: "NOTE", text: parsed.data } });
  revalidatePath("/admin", "layout");
  return { ok: true };
}

/** Records to whom the file is handed, then opens the printable file. Every transmission leaves a trace. */
export async function exportCase(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const recipient = z
    .string()
    .trim()
    .min(5, "Indiquez l'autorité destinataire et, si possible, la référence de sa demande.")
    .max(200, "200 caractères au maximum.")
    .safeParse(formData.get("recipient"));
  if (!recipient.success) return fail(z.flattenError(recipient.error).formErrors[0]);
  const theftCase = await prisma.theftCase.findFirst({ where: { id, status: "ACTIVE" } });
  if (!theftCase) return fail("Seul un dossier en recherche active peut être transmis.");

  const event = await prisma.caseEvent.create({
    data: { theftCaseId: id, authorId: admin.id, kind: "EXPORT", text: recipient.data },
  });
  await audit("theft.exported", admin.id, caseReference(theftCase.number));
  redirect(`/admin/dossiers/${id}/export?e=${event.id}`);
}

/** Closes a case with its outcome. The vehicle stops being shown as stolen, and the team stops seeing its positions. */
export async function closeCase(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const outcome = String(formData.get("outcome"));
  if (!(outcome in CASE_OUTCOME)) return fail("Choisissez l'issue du dossier.");
  const parsed = note("Résumez l'issue du dossier.").safeParse(formData.get("text"));
  if (!parsed.success) return fail(z.flattenError(parsed.error).formErrors[0]);

  const { count } = await prisma.theftCase.updateMany({
    where: { id, status: "ACTIVE" },
    data: { status: "CLOSED", closedAt: new Date(), outcome: outcome as keyof typeof CASE_OUTCOME, closingNote: parsed.data },
  });
  if (!count) return fail("Ce dossier n'est pas en recherche active.");
  const theftCase = await prisma.theftCase.findUniqueOrThrow({ where: { id }, include: { declarant: true } });
  const reference = caseReference(theftCase.number);
  await audit(`theft.closed.${outcome.toLowerCase()}`, admin.id, reference);
  await notify(
    theftCase.declarant.email,
    `Votre dossier de vol ${reference} est clos`,
    `Issue : ${CASE_OUTCOME[outcome as keyof typeof CASE_OUTCOME]}.\n\n${siteUrl}/vehicules/${theftCase.vehicleId}/vol`,
  );
  revalidatePath("/", "layout");
  return { ok: true };
}
