"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { listingInput } from "@/lib/listing";
import { sendMail } from "@/lib/mail";
import { MAX_PHOTO_BYTES, MAX_PHOTOS, deletePhotos, storePhotos } from "@/lib/photos";
import { contactOf, requireAdmin, requireUser } from "@/lib/session";

export type FormState = {
  ok?: boolean;
  errors?: Record<string, string[] | undefined>;
  values?: Record<string, string>;
};

const MAX_PENDING_PER_SELLER = 10;
const site = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

export async function createListing(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const values = Object.fromEntries(
    // Text fields only: no files, and none of React's own "$ACTION…" bookkeeping entries.
    [...formData].filter((e): e is [string, string] => typeof e[1] === "string" && !e[0].startsWith("$")),
  );
  const parsed = listingInput.safeParse(values);
  const errors: FormState["errors"] = parsed.success ? {} : z.flattenError(parsed.error).fieldErrors;

  const photos = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (photos.length < 1 || photos.length > MAX_PHOTOS) {
    errors.photos = [`Ajoutez entre 1 et ${MAX_PHOTOS} photos.`];
  } else if (photos.some((f) => f.size > MAX_PHOTO_BYTES)) {
    errors.photos = ["Chaque photo doit peser moins de 8 Mo."];
  }
  if (!parsed.success || errors.photos) return { errors, values };

  const pending = await prisma.listing.count({ where: { sellerId: user.id, status: "PENDING" } });
  if (pending >= MAX_PENDING_PER_SELLER) {
    return { errors: { form: ["Vous avez déjà 10 annonces en attente de validation."] }, values };
  }

  let photoIds: string[];
  try {
    photoIds = await storePhotos(photos);
  } catch {
    return { errors: { photos: ["Une photo est illisible. Utilisez des images JPEG, PNG ou WebP."] }, values };
  }
  try {
    await prisma.listing.create({
      data: {
        ...parsed.data,
        sellerId: user.id,
        photos: { create: photoIds.map((id, position) => ({ id, position })) },
      },
    });
  } catch (e) {
    await deletePhotos(photoIds);
    throw e;
  }
  redirect("/mes-annonces");
}

/** The seller, or an admin, takes a listing offline. */
export async function archiveListing(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  await prisma.listing.updateMany({
    where: { id, ...(user.role === "admin" ? {} : { sellerId: user.id }) },
    data: { status: "ARCHIVED" },
  });
  revalidatePath("/", "layout");
}

export async function moderateListing(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const publish = formData.get("decision") === "publish";
  const reason = String(formData.get("reason") ?? "").trim();
  if (!publish && reason.length < 5) {
    return { errors: { reason: ["Indiquez au vendeur pourquoi l'annonce est refusée."] } };
  }

  // The status filter makes a double click, or two admins, decide only once.
  const { count } = await prisma.listing.updateMany({
    where: { id, status: "PENDING" },
    data: publish
      ? { status: "PUBLISHED", publishedAt: new Date(), rejectionReason: null }
      : { status: "REJECTED", rejectionReason: reason },
  });
  if (count) {
    await prisma.auditLog.create({
      data: { action: publish ? "listing.published" : "listing.rejected", actorId: admin.id, target: id },
    });
    const listing = await prisma.listing.findUniqueOrThrow({ where: { id }, include: { seller: true } });
    const title = `${listing.brand} ${listing.model}`;
    await sendMail(
      listing.seller.email,
      publish ? `Votre annonce ${title} est en ligne` : `Votre annonce ${title} n'a pas été publiée`,
      publish
        ? `Votre annonce est visible ici : ${site}/annonces/${id}`
        : `Motif : ${reason}\n\nVous pouvez déposer une nouvelle annonce corrigée : ${site}/vendre`,
    );
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

const inquiryInput = z.object({
  message: z
    .string()
    .trim()
    .min(10, "Écrivez un message de 10 caractères au moins.")
    .max(1000, "1000 caractères au maximum."),
});

export async function sendInquiry(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const listingId = String(formData.get("listingId"));
  const parsed = inquiryInput.safeParse({ message: formData.get("message") });
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };

  const listing = await prisma.listing.findFirst({
    where: { id: listingId, status: "PUBLISHED", sellerId: { not: user.id } },
    include: { seller: true },
  });
  if (!listing) return { errors: { message: ["Cette annonce n'est plus disponible."] } };

  const { message } = parsed.data;
  await prisma.inquiry.upsert({
    where: { listingId_buyerId: { listingId, buyerId: user.id } },
    create: { listingId, buyerId: user.id, message },
    update: { message, createdAt: new Date() },
  });
  await sendMail(
    listing.seller.email,
    `Nouvelle demande pour votre ${listing.brand} ${listing.model}`,
    `${message}\n\nContact de l'acheteur : ${contactOf(user)}\n\nToutes vos demandes : ${site}/mes-annonces`,
  );
  return { ok: true };
}

export async function toggleFavorite(formData: FormData) {
  const user = await requireUser();
  const listingId = String(formData.get("listingId"));
  const key = { userId_listingId: { userId: user.id, listingId } };
  if (await prisma.favorite.findUnique({ where: key })) {
    await prisma.favorite.delete({ where: key });
  } else if (await prisma.listing.findFirst({ where: { id: listingId, status: "PUBLISHED" } })) {
    await prisma.favorite.create({ data: { userId: user.id, listingId } });
  }
  revalidatePath("/", "layout");
}

const reportInput = z.object({
  reason: z
    .string()
    .trim()
    .min(10, "Expliquez le problème en 10 caractères au moins.")
    .max(500, "500 caractères au maximum."),
});

export async function reportListing(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const listingId = String(formData.get("listingId"));
  const parsed = reportInput.safeParse({ reason: formData.get("reason") });
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  if (!(await prisma.listing.findFirst({ where: { id: listingId, status: "PUBLISHED" } }))) {
    return { errors: { reason: ["Cette annonce n'est plus disponible."] } };
  }
  const { reason } = parsed.data;
  await prisma.report.upsert({
    where: { listingId_reporterId: { listingId, reporterId: user.id } },
    create: { listingId, reporterId: user.id, reason },
    update: { reason, createdAt: new Date(), resolvedAt: null },
  });
  return { ok: true };
}

/** An admin closes a report, optionally taking the listing offline. */
export async function resolveReport(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const report = await prisma.report.update({ where: { id }, data: { resolvedAt: new Date() } });
  const remove = formData.get("decision") === "remove";
  if (remove) {
    await prisma.listing.update({ where: { id: report.listingId }, data: { status: "ARCHIVED" } });
  }
  await prisma.auditLog.create({
    data: { action: remove ? "report.listing_removed" : "report.dismissed", actorId: admin.id, target: report.listingId },
  });
  revalidatePath("/", "layout");
}
