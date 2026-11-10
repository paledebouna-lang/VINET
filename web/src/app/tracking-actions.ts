"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "./actions";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { zoneInput } from "@/lib/tracking";

export type TrackerState = FormState & { deviceKey?: string };

const trackerInput = z.object({
  model: z.string().trim().min(2, "Indiquez la marque et le modèle de la balise.").max(60, "60 caractères au maximum."),
  serial: z
    .string()
    .transform((s) => s.replace(/[\s-]/g, "").toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{5,20}$/, "Numéro de série ou IMEI : 5 à 20 lettres et chiffres.")),
});

const text = (formData: FormData) =>
  Object.fromEntries(
    [...formData].filter((e): e is [string, string] => typeof e[1] === "string" && !e[0].startsWith("$")),
  );

const ownVehicle = (id: string, userId: string) =>
  prisma.vehicle.findFirst({ where: { id, ownerId: userId }, include: { tracker: true } });

/**
 * Declares the tracker fitted to a vehicle and issues its key. Submitting again for a vehicle
 * that already has one replaces the key: the old one stops working at once.
 */
export async function saveTracker(_prev: TrackerState, formData: FormData): Promise<TrackerState> {
  const user = await requireUser();
  const values = text(formData);
  const vehicle = await ownVehicle(values.vehicleId, user.id);
  if (!vehicle) return { errors: { form: ["Ce véhicule est introuvable."] }, values };
  const parsed = trackerInput.safeParse(values);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };

  const other = await prisma.tracker.findUnique({ where: { serial: parsed.data.serial } });
  if (other && other.vehicleId !== vehicle.id) {
    return { errors: { serial: ["Cette balise est déjà déclarée sur un autre véhicule."] }, values };
  }
  // 256 random bits; only its hash is kept, so the key cannot be read back from the database.
  const deviceKey = randomBytes(32).toString("base64url");
  const data = { ...parsed.data, keyHash: createHash("sha256").update(deviceKey).digest("hex") };
  await prisma.tracker.upsert({
    where: { vehicleId: vehicle.id },
    create: { ...data, vehicleId: vehicle.id },
    update: data,
  });
  await prisma.auditLog.create({ data: { action: "tracker.key_issued", actorId: user.id, target: vehicle.avsId } });
  revalidatePath("/", "layout");
  return { ok: true, deviceKey, values };
}

export async function saveZone(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const values = text(formData);
  const vehicle = await ownVehicle(values.vehicleId, user.id);
  if (!vehicle) return { errors: { form: ["Ce véhicule est introuvable."] }, values };
  if (values.clear === "on") {
    await prisma.vehicle.update({ where: { id: vehicle.id }, data: { zoneLat: null, zoneLng: null, zoneRadiusKm: null } });
    revalidatePath("/", "layout");
    return { ok: true, values: { cleared: "on" } };
  } else {
    const parsed = zoneInput.safeParse(values);
    if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };
    await prisma.vehicle.update({ where: { id: vehicle.id }, data: parsed.data });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function acknowledgeAlert(formData: FormData) {
  const user = await requireUser();
  await prisma.alert.updateMany({
    where: { id: String(formData.get("id")), vehicle: { ownerId: user.id }, acknowledgedAt: null },
    data: { acknowledgedAt: new Date() },
  });
  revalidatePath("/", "layout");
}
