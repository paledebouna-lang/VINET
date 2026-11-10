"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { formatPrice, listingInput, sellerProfileInput } from "@/lib/listing";
import { sendMail } from "@/lib/mail";
import { MAX_PHOTO_BYTES, MAX_PHOTOS, deletePhotos, storePhotos } from "@/lib/photos";
import { requireAdmin, requireUser } from "@/lib/session";

export type FormState = {
  ok?: boolean;
  errors?: Record<string, string[] | undefined>;
  values?: Record<string, string>;
};

const MAX_PENDING_PER_SELLER = 10;
const site = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

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

const unreadablePhoto = ["Une photo est illisible. Utilisez des images JPEG, PNG ou WebP."];

// A notification that fails must not undo the action it reports. E-mails never carry
// the other party's contact details or the message text: exchanges stay on the site.
const notify = (to: string, subject: string, text: string) =>
  sendMail(to, subject, text).catch((e) => console.error("notification e-mail failed", e));

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

export async function createListing(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!(await prisma.sellerProfile.findUnique({ where: { userId: user.id } }))) redirect("/compte/identite");

  const values = textFields(formData);
  const parsed = listingInput.safeParse(values);
  const errors: FormState["errors"] = parsed.success ? {} : z.flattenError(parsed.error).fieldErrors;
  const photos = newPhotos(formData);
  errors.photos = photoError(photos.length, photos);
  if (!parsed.success || errors.photos) return { errors, values };

  const pending = await prisma.listing.count({ where: { sellerId: user.id, status: "PENDING" } });
  if (pending >= MAX_PENDING_PER_SELLER) {
    return { errors: { form: ["Vous avez déjà 10 annonces en attente de validation."] }, values };
  }

  let photoIds: string[];
  try {
    photoIds = await storePhotos(photos);
  } catch {
    return { errors: { photos: unreadablePhoto }, values };
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

/** The seller edits a listing. Any edit sends it back to moderation, or moderation could be bypassed. */
export async function updateListing(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const listing = await prisma.listing.findFirst({
    where: { id, sellerId: user.id },
    include: { photos: { orderBy: { position: "asc" } } },
  });
  if (!listing) return { errors: { form: ["Cette annonce est introuvable."] } };

  const values = textFields(formData);
  const parsed = listingInput.safeParse(values);
  const errors: FormState["errors"] = parsed.success ? {} : z.flattenError(parsed.error).fieldErrors;
  const keep = new Set(formData.getAll("keep").map(String));
  const kept = listing.photos.filter((p) => keep.has(p.id));
  const removed = listing.photos.filter((p) => !keep.has(p.id)).map((p) => p.id);
  const added = newPhotos(formData);
  errors.photos = photoError(kept.length + added.length, added);
  if (!parsed.success || errors.photos) return { errors, values };

  let addedIds: string[];
  try {
    addedIds = await storePhotos(added);
  } catch {
    return { errors: { photos: unreadablePhoto }, values };
  }
  try {
    await prisma.$transaction([
      prisma.listingPhoto.deleteMany({ where: { id: { in: removed } } }),
      ...kept.map((p, position) => prisma.listingPhoto.update({ where: { id: p.id }, data: { position } })),
      prisma.listing.update({
        where: { id },
        data: {
          ...parsed.data,
          status: "PENDING",
          rejectionReason: null,
          // Remembered across several edits until one is published.
          previousPriceFcfa: listing.previousPriceFcfa ?? listing.priceFcfa,
          photos: { create: addedIds.map((pid, i) => ({ id: pid, position: kept.length + i })) },
        },
      }),
    ]);
  } catch (e) {
    await deletePhotos(addedIds);
    throw e;
  }
  await deletePhotos(removed);
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
    const title = `${before.brand} ${before.model}`;
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
    prisma.message.create({ data: { conversationId: conversation.id, senderId: user.id, body: parsed.data.body } }),
    prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: now, [isBuyer ? "buyerReadAt" : "sellerReadAt"]: now },
    }),
  ]);
  const { listing } = conversation;
  await notify(
    (isBuyer ? listing.seller : conversation.buyer).email,
    `Nouveau message à propos de ${listing.brand} ${listing.model}`,
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
