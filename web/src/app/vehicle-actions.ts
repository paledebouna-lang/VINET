"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "./actions";
import { prisma } from "@/lib/db";
import { maskContacts } from "@/lib/listing";
import { notify, siteUrl } from "@/lib/mail";
import { MAX_PHOTO_BYTES, deletePhotos, storePhotos } from "@/lib/photos";
import { requireAdmin, requireUser } from "@/lib/session";
import { newAvsId, parseAvsId, parsePosition, sightingInput, vehicleInput } from "@/lib/vehicle";

const MAX_VEHICLES = 50;
const MAX_SIGHTINGS_PER_DAY = 20;

const text = (formData: FormData) =>
  Object.fromEntries(
    [...formData].filter((e): e is [string, string] => typeof e[1] === "string" && !e[0].startsWith("$")),
  );

/** The owner registers a vehicle and gets its AVS passport. An admin then checks the registration papers. */
export async function createVehicle(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const values = text(formData);
  const parsed = vehicleInput.safeParse(values);
  const errors: FormState["errors"] = parsed.success ? {} : z.flattenError(parsed.error).fieldErrors;
  const file = formData.get("registration");
  const registration = file instanceof File && file.size > 0 ? file : null;
  if (!registration) errors.registration = ["Joignez une photo de la carte grise."];
  else if (registration.size > MAX_PHOTO_BYTES) errors.registration = ["Le fichier doit peser moins de 8 Mo."];
  if (!parsed.success || !registration || errors.registration) return { errors, values };

  if ((await prisma.vehicle.count({ where: { ownerId: user.id } })) >= MAX_VEHICLES) {
    return { errors: { form: ["Vous avez atteint le nombre maximal de véhicules."] }, values };
  }
  if (await prisma.vehicle.findUnique({ where: { serial: parsed.data.serial } })) {
    return {
      errors: {
        serial: ["Ce numéro de série a déjà un passeport AVS. Si ce véhicule est le vôtre, écrivez à l'équipe MonAuto."],
      },
      values,
    };
  }

  let docIds: string[];
  try {
    docIds = await storePhotos([registration]);
  } catch {
    return { errors: { registration: ["Image illisible. Utilisez un fichier JPEG, PNG ou WebP."] }, values };
  }
  let vehicle;
  try {
    vehicle = await prisma.vehicle.create({
      data: {
        ...parsed.data,
        avsId: newAvsId(),
        ownerId: user.id,
        documents: { create: docIds.map((id) => ({ id, kind: "REGISTRATION" as const })) },
      },
    });
  } catch (e) {
    await deletePhotos(docIds);
    throw e;
  }
  await prisma.auditLog.create({ data: { action: "vehicle.registered", actorId: user.id, target: vehicle.avsId } });
  redirect(`/vehicules/${vehicle.id}`);
}

/** An admin confirms, after checking the registration papers, that the passport matches the vehicle and its owner. */
export async function verifyVehicle(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const vehicle = await prisma.vehicle.update({ where: { id }, data: { verifiedAt: new Date() }, include: { owner: true } });
  await prisma.auditLog.create({ data: { action: "vehicle.verified", actorId: admin.id, target: vehicle.avsId } });
  await notify(
    vehicle.owner.email,
    `Le passeport AVS de votre ${vehicle.brand} ${vehicle.model} est vérifié`,
    `Imprimez son étiquette QR ici : ${siteUrl}/vehicules/${vehicle.id}`,
  );
  revalidatePath("/", "layout");
}

/** What someone reports after scanning a QR code. Requires an account, so that every report has an author. */
export async function reportSighting(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const values = text(formData);
  const parsed = sightingInput.safeParse(values);
  const errors: FormState["errors"] = parsed.success ? {} : z.flattenError(parsed.error).fieldErrors;
  if (values.sincere !== "on") errors.sincere = ["Confirmez que votre signalement est sincère."];
  if (!parsed.success || errors.sincere) return { errors, values };

  const avsId = parseAvsId(values.avsId ?? "");
  const vehicle = avsId ? await prisma.vehicle.findUnique({ where: { avsId }, include: { owner: true } }) : null;
  if (!vehicle) return { errors: { form: ["Ce véhicule est introuvable."] }, values };
  if (vehicle.ownerId === user.id) return { errors: { form: ["Ce véhicule est le vôtre."] }, values };

  const since = (ms: number) => ({ gt: new Date(Date.now() - ms) });
  const [sameVehicle, today] = await Promise.all([
    prisma.sighting.count({ where: { reporterId: user.id, vehicleId: vehicle.id, createdAt: since(3_600_000) } }),
    prisma.sighting.count({ where: { reporterId: user.id, createdAt: since(86_400_000) } }),
  ]);
  if (sameVehicle || today >= MAX_SIGHTINGS_PER_DAY) {
    return { errors: { form: ["Vous avez déjà signalé ce véhicule récemment. Réessayez plus tard."] }, values };
  }

  const { kind, note } = parsed.data;
  await prisma.sighting.create({
    data: {
      vehicleId: vehicle.id,
      reporterId: user.id,
      kind,
      note: maskContacts(note),
      // Stored only when the reporter ticked the box; null otherwise.
      ...parsePosition(values),
    },
  });
  // An observation is for the owner; a suspicion goes to the team only, since it may concern the owner.
  if (kind === "OBSERVATION") {
    await notify(
      vehicle.owner.email,
      `Votre ${vehicle.brand} ${vehicle.model} a été observé`,
      `Quelqu'un a scanné son QR AVS et déclaré une observation : ${siteUrl}/vehicules/${vehicle.id}`,
    );
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** An admin marks a suspicion as handled. */
export async function reviewSighting(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  await prisma.sighting.update({ where: { id }, data: { reviewedAt: new Date() } });
  await prisma.auditLog.create({ data: { action: "sighting.reviewed", actorId: admin.id, target: id } });
  revalidatePath("/admin", "layout");
}
