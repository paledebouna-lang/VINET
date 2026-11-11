"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "./actions";
import { prisma } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/session";
import { beaconInput, computeEid, keyFingerprint, sealKey } from "@/lib/vinet";

export type DetectorState = FormState & { detectorKey?: string };

const text = (formData: FormData) =>
  Object.fromEntries(
    [...formData].filter((e): e is [string, string] => typeof e[1] === "string" && !e[0].startsWith("$")),
  );

/**
 * Registers the VINET beacon fitted to a vehicle (Eddystone-EID, shared identity key).
 * The identifier the beacon broadcasts right now proves the key and the clock were copied correctly.
 */
export async function registerBeacon(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const values = text(formData);
  const vehicle = await prisma.vehicle.findFirst({ where: { id: values.vehicleId, ownerId: user.id } });
  if (!vehicle) return { errors: { form: ["Ce véhicule est introuvable."] }, values };
  const parsed = beaconInput.safeParse(values);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };

  const { rotationExponent, counter, eid } = parsed.data;
  const identityKey = Buffer.from(parsed.data.identityKey, "hex");
  if (computeEid(identityKey, rotationExponent, counter) !== eid) {
    return {
      errors: { eid: ["Cet identifiant ne correspond pas à la clé, à l'exposant et au compteur saisis. Relevez les quatre valeurs au même moment."] },
      values,
    };
  }
  const keyHash = keyFingerprint(identityKey);
  const other = await prisma.beacon.findUnique({ where: { keyHash } });
  if (other && other.vehicleId !== vehicle.id) {
    return { errors: { identityKey: ["Cette balise est déjà enregistrée sur un autre véhicule."] }, values };
  }
  const data = {
    sealedKey: sealKey(identityKey),
    keyHash,
    rotationExponent,
    clockOffset: Math.floor(Date.now() / 1000) - counter,
    lastDetectedAt: null,
  };
  await prisma.beacon.upsert({ where: { vehicleId: vehicle.id }, create: { ...data, vehicleId: vehicle.id }, update: data });
  await prisma.auditLog.create({ data: { action: "beacon.registered", actorId: user.id, target: vehicle.avsId } });
  revalidatePath("/", "layout");
  // The key is not sent back to the page.
  return { ok: true };
}

export async function removeBeacon(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const vehicle = await prisma.vehicle.findFirst({ where: { id: String(formData.get("vehicleId")), ownerId: user.id } });
  if (!vehicle) return { errors: { form: ["Ce véhicule est introuvable."] } };
  // Its detections go with it.
  await prisma.beacon.deleteMany({ where: { vehicleId: vehicle.id } });
  await prisma.auditLog.create({ data: { action: "beacon.removed", actorId: user.id, target: vehicle.avsId } });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** The team adds a partner detector and receives its key, shown once. */
export async function createDetector(_prev: DetectorState, formData: FormData): Promise<DetectorState> {
  const admin = await requireAdmin();
  const name = z
    .string()
    .trim()
    .min(3, "Nommez le détecteur : partenaire et emplacement.")
    .max(80, "80 caractères au maximum.")
    .safeParse(formData.get("name"));
  if (!name.success) return { errors: { name: z.flattenError(name.error).formErrors } };
  const detectorKey = randomBytes(32).toString("base64url");
  const detector = await prisma.detector.create({
    data: { name: name.data, keyHash: createHash("sha256").update(detectorKey).digest("hex") },
  });
  await prisma.auditLog.create({ data: { action: "detector.created", actorId: admin.id, target: detector.id } });
  revalidatePath("/admin/detecteurs");
  return { ok: true, detectorKey };
}

export async function revokeDetector(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const { count } = await prisma.detector.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } });
  if (count) await prisma.auditLog.create({ data: { action: "detector.revoked", actorId: admin.id, target: id } });
  revalidatePath("/admin/detecteurs");
  return { ok: true };
}
