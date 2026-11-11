"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { formatPrice, listingTitle, maskContacts, parseListing, rentalInput, sellerProfileInput } from "@/lib/listing";
import { notify, siteUrl as site } from "@/lib/mail";
import { MAX_PHOTO_BYTES, MAX_PHOTOS, deletePhotos, storePhotos } from "@/lib/photos";
import { requireAdmin, requireUser } from "@/lib/session";

export type FormState = {
  ok?: boolean;
  errors?: Record<string, string[] | undefined>;
  values?: Record<string, string>;
};

const MAX_PENDING_PER_SELLER = 10;

// Text fields only: no files, and none of React's own "$ACTION…" bookkeeping entries.
const textFields = (formData: FormData) =>
  Object.fromEntries(
    [...formData].filter((e): e is [string, string] => typeof e[1] === "string" && !e[0].startsWith("$")),
  );

const newPhotos = (formData: FormData) =>
  formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);

function photoError(total: number, added: File[]) {
  if (total < 1 || total > MAX_PHOTOS) return [`Une annonce compte entre 1 et ${MAX_PHOTOS} photos.`];
  if (added.some((f) => f.size > MAX_PHOTO_BYTES)) return ["Chaque photo doit peser moins de 8 Mo."];
}

const unreadableImage = ["Une image est illisible. Utilisez des fichiers JPEG, PNG ou WebP."];

export async function saveSellerProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const values = textFields(formData);
  const parsed = sellerProfileInput.safeParse(values);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };
  await prisma.sellerProfile.upsert({
    where: { userId: user.id },
    create: { ...parsed.data, userId: user.id },
    // An edited identity has to be checked again.
    update: { ...parsed.data, verifiedAt: null },
  });
  revalidatePath("/", "layout");
  return { ok: true, values };
}

/** The passport chosen in the form, if it really is one of this seller's vehicles. */
async function ownVehicleId(values: Record<string, string>, userId: string) {
  const { vehicleId } = values;
  if (!vehicleId || values.category === "PIECE") return null;
  const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, ownerId: userId }, select: { id: true } });
  return vehicle?.id ?? null;
}

const noRental = { depositFcfa: null, kmPerDay: null, zone: null, gpsModel: null, gpsSerial: null };

/** Reads and validates the listing form shared by creation and edition. */
function readListingForm(formData: FormData, keptPhotos: number, hasInsurance: boolean) {
  const values = textFields(formData);
  const parsed = parseListing(values);
  const errors: FormState["errors"] = { ...parsed.errors };

  // A rental offer needs a declared GPS and proof of insurance.
  const isRent = values.kind === "RENT";
  const rental = isRent ? rentalInput.safeParse(values) : null;
  if (rental && !rental.success) Object.assign(errors, z.flattenError(rental.error).fieldErrors);
  const file = formData.get("insurance");
  const insurance = file instanceof File && file.size > 0 ? file : null;
  if (isRent && !insurance && !hasInsurance) errors.insurance = ["Joignez une photo de l'attestation d'assurance."];
  if (insurance && insurance.size > MAX_PHOTO_BYTES) errors.insurance = ["Le fichier doit peser moins de 8 Mo."];

  const photos = newPhotos(formData);
  errors.photos = photoError(keptPhotos + photos.length, photos);

  const valid = parsed.data && (!rental || rental.success) && !Object.values(errors).some(Boolean);
  return {
    values,
    errors,
    photos,
    insurance: isRent ? insurance : null,
    isRent,
    data: valid
      ? {
          ...parsed.data!,
          // Contact details stay off the site, in titles as in descriptions.
          brand: maskContacts(parsed.data!.brand),
          model: maskContacts(parsed.data!.model),
          partName: parsed.data!.partName && maskContacts(parsed.data!.partName),
          description: maskContacts(parsed.data!.description),
          ...(rental?.success ? rental.data : noRental),
        }
      : null,
  };
}

export async function createListing(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!(await prisma.sellerProfile.findUnique({ where: { userId: user.id } }))) redirect("/compte/identite");

  const form = readListingForm(formData, 0, false);
  const { values } = form;
  if (!form.data) return { errors: form.errors, values };

  const pending = await prisma.listing.count({ where: { sellerId: user.id, status: "PENDING" } });
  if (pending >= MAX_PENDING_PER_SELLER) {
    return { errors: { form: ["Vous avez déjà 10 annonces en attente de validation."] }, values };
  }

  let photoIds: string[];
  let insuranceIds: string[];
  try {
    photoIds = await storePhotos(form.photos);
    insuranceIds = await storePhotos(form.insurance ? [form.insurance] : []);
  } catch {
    return { errors: { photos: unreadableImage }, values };
  }
  try {
    await prisma.listing.create({
      data: {
        ...form.data,
        vehicleId: await ownVehicleId(values, user.id),
        sellerId: user.id,
        photos: { create: photoIds.map((id, position) => ({ id, position })) },
        documents: { create: insuranceIds.map((id) => ({ id, kind: "INSURANCE" as const })) },
      },
    });
  } catch (e) {
    await deletePhotos([...photoIds, ...insuranceIds]);
    throw e;
  }
  redirect("/mes-annonces");
}

/** The seller edits a listing. Any edit sends it back to moderation, or moderation could be bypassed. */
export async function updateListing(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const listing = await prisma.listing.findFirst({
    where: { id, sellerId: user.id },
    include: { photos: { orderBy: { position: "asc" } }, documents: { where: { kind: "INSURANCE" } } },
  });
  if (!listing) return { errors: { form: ["Cette annonce est introuvable."] } };

  const keep = new Set(formData.getAll("keep").map(String));
  const kept = listing.photos.filter((p) => keep.has(p.id));
  const removed = listing.photos.filter((p) => !keep.has(p.id)).map((p) => p.id);
  const form = readListingForm(formData, kept.length, listing.documents.length > 0);
  const { values } = form;
  if (!form.data) return { errors: form.errors, values };

  const vehicleId = await ownVehicleId(values, user.id);
  // A new attestation replaces the old one; a listing switched to a sale drops it.
  const oldInsurance = form.insurance || !form.isRent ? listing.documents.map((d) => d.id) : [];
  let addedIds: string[];
  let insuranceIds: string[];
  try {
    addedIds = await storePhotos(form.photos);
    insuranceIds = await storePhotos(form.insurance ? [form.insurance] : []);
  } catch {
    return { errors: { photos: unreadableImage }, values };
  }
  try {
    await prisma.$transaction([
      prisma.listingPhoto.deleteMany({ where: { id: { in: removed } } }),
      prisma.document.deleteMany({ where: { id: { in: oldInsurance } } }),
      ...kept.map((p, position) => prisma.listingPhoto.update({ where: { id: p.id }, data: { position } })),
      prisma.listing.update({
        where: { id },
        data: {
          ...form.data,
          vehicleId,
          status: "PENDING",
          submittedAt: new Date(),
          rejectionReason: null,
          // Remembered across several edits until one is published.
          previousPriceFcfa: listing.previousPriceFcfa ?? listing.priceFcfa,
          photos: { create: addedIds.map((pid, i) => ({ id: pid, position: kept.length + i })) },
          documents: { create: insuranceIds.map((did) => ({ id: did, kind: "INSURANCE" as const })) },
        },
      }),
    ]);
  } catch (e) {
    await deletePhotos([...addedIds, ...insuranceIds]);
    throw e;
  }
  await deletePhotos([...removed, ...oldInsurance]);
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

  const before = await prisma.listing.findUnique({ where: { id }, include: { seller: true } });
  // A vehicle under an active theft search is never put on offer.
  if (publish && before?.vehicleId && (await prisma.theftCase.count({ where: { vehicleId: before.vehicleId, status: "ACTIVE" } }))) {
    return { errors: { reason: ["Ce véhicule est déclaré volé : l'annonce ne peut pas être publiée."] } };
  }
  // The status filter makes a double click, or two admins, decide only once.
  const { count } = await prisma.listing.updateMany({
    where: { id, status: "PENDING" },
    data: publish
      ? { status: "PUBLISHED", publishedAt: new Date(), rejectionReason: null, previousPriceFcfa: null }
      : { status: "REJECTED", rejectionReason: reason },
  });
  if (count && before) {
    await prisma.auditLog.create({
      data: { action: publish ? "listing.published" : "listing.rejected", actorId: admin.id, target: id },
    });
    const title = listingTitle(before);
    await notify(
      before.seller.email,
      publish ? `Votre annonce ${title} est en ligne` : `Votre annonce ${title} n'a pas été publiée`,
      publish
        ? `Votre annonce est visible ici : ${site}/annonces/${id}`
        : `Motif : ${reason}\n\nCorrigez votre annonce ici : ${site}/annonces/${id}/modifier`,
    );
    // Price alert: the price went down with this edit, tell everyone who saved it at a higher price.
    if (publish && before.previousPriceFcfa && before.priceFcfa < before.previousPriceFcfa) {
      const watchers = await prisma.favorite.findMany({
        where: { listingId: id, priceAtSave: { gt: before.priceFcfa } },
        include: { user: true },
      });
      await Promise.all(
        watchers.map((w) =>
          notify(
            w.user.email,
            `Baisse de prix : ${title}`,
            `Le prix est passé de ${formatPrice(w.priceAtSave)} à ${formatPrice(before.priceFcfa)}.\n\n${site}/annonces/${id}`,
          ),
        ),
      );
    }
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** An admin confirms a seller's identity after checking it. */
export async function verifySeller(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId"));
  await prisma.sellerProfile.update({ where: { userId }, data: { verifiedAt: new Date() } });
  await prisma.auditLog.create({ data: { action: "seller.verified", actorId: admin.id, target: userId } });
  revalidatePath("/", "layout");
}

const messageInput = z.object({
  body: z.string().trim().min(2, "Écrivez votre message.").max(1000, "1000 caractères au maximum."),
});

/**
 * Sends a message. With conversationId it is a reply from either side; with listingId
 * it is a buyer opening, or continuing, the conversation about that listing.
 */
export async function sendMessage(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = messageInput.safeParse({ body: formData.get("body") });
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };

  const lastMinute = await prisma.message.count({
    where: { senderId: user.id, createdAt: { gt: new Date(Date.now() - 60_000) } },
  });
  if (lastMinute >= 10) return { errors: { body: ["Trop de messages envoyés. Patientez une minute."] } };

  const include = { listing: { include: { seller: true } }, buyer: true } as const;
  const conversationId = formData.get("conversationId");
  const listingId = String(formData.get("listingId"));
  const conversation = conversationId
    ? await prisma.conversation.findFirst({
        // Only the two parties can write in a conversation.
        where: { id: String(conversationId), OR: [{ buyerId: user.id }, { listing: { sellerId: user.id } }] },
        include,
      })
    : (await prisma.listing.findFirst({ where: { id: listingId, status: "PUBLISHED", sellerId: { not: user.id } } }))
      ? await prisma.conversation.upsert({
          where: { listingId_buyerId: { listingId, buyerId: user.id } },
          create: { listingId, buyerId: user.id },
          update: {},
          include,
        })
      : null;
  if (!conversation) return { errors: { body: ["Cette conversation n'est plus disponible."] } };

  const isBuyer = conversation.buyerId === user.id;
  const now = new Date();
  await prisma.$transaction([
    prisma.message.create({
      // Stored already masked: neither side, nor an admin later, sees the contact details.
      data: { conversationId: conversation.id, senderId: user.id, body: maskContacts(parsed.data.body) },
    }),
    prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: now, [isBuyer ? "buyerReadAt" : "sellerReadAt"]: now },
    }),
  ]);
  const { listing } = conversation;
  await notify(
    (isBuyer ? listing.seller : conversation.buyer).email,
    `Nouveau message à propos de ${listingTitle(listing)}`,
    `Vous avez reçu un message sur MonAuto. Lisez-le et répondez ici : ${site}/messages/${conversation.id}`,
  );
  if (!conversationId) redirect(`/messages/${conversation.id}`);
  revalidatePath(`/messages/${conversation.id}`);
  return { ok: true };
}

export async function toggleFavorite(formData: FormData) {
  const user = await requireUser();
  const listingId = String(formData.get("listingId"));
  const key = { userId_listingId: { userId: user.id, listingId } };
  if (await prisma.favorite.findUnique({ where: key })) {
    await prisma.favorite.delete({ where: key });
  } else {
    const listing = await prisma.listing.findFirst({ where: { id: listingId, status: "PUBLISHED" } });
    if (listing) {
      await prisma.favorite.create({ data: { userId: user.id, listingId, priceAtSave: listing.priceFcfa } });
    }
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
