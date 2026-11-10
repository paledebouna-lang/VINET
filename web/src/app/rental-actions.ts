"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "./actions";
import { prisma } from "@/lib/db";
import { notify, siteUrl } from "@/lib/mail";
import { MAX_PHOTO_BYTES, MAX_PHOTOS, deletePhotos, storePhotos } from "@/lib/photos";
import { contractText, inspectionInput, parseBooking } from "@/lib/rental";
import { requireUser } from "@/lib/session";

const MAX_OPEN_REQUESTS = 5;
// A vehicle is taken on the days of a booking in one of these states.
const BLOCKING = ["ACCEPTED", "SIGNED", "ACTIVE"] as const;
const unreadableImage = ["Une image est illisible. Utilisez des fichiers JPEG, PNG ou WebP."];

const text = (formData: FormData) =>
  Object.fromEntries(
    [...formData].filter((e): e is [string, string] => typeof e[1] === "string" && !e[0].startsWith("$")),
  );
const images = (formData: FormData, name: string) =>
  formData.getAll(name).filter((f): f is File => f instanceof File && f.size > 0);

const link = (id: string) => `${siteUrl}/locations/${id}`;
const fail = (message: string): FormState => ({ errors: { form: [message] } });

async function audit(action: string, actorId: string, target: string) {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim();
  await prisma.auditLog.create({ data: { action, actorId, target, ip } });
}

/** The booking and the caller's side of it, or null when the caller is neither party. */
async function partyOf(bookingId: string, userId: string) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, OR: [{ renterId: userId }, { listing: { sellerId: userId } }] },
    include: { renter: true, listing: { include: { seller: { include: { sellerProfile: true } } } } },
  });
  return booking ? { booking, isOwner: booking.listing.sellerId === userId } : null;
}

const dayOverlap = (listingId: string, start: Date, end: Date) => ({
  listingId,
  status: { in: [...BLOCKING] },
  startDate: { lte: end },
  endDate: { gte: start },
});

export async function requestBooking(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const values = text(formData);
  const listingId = values.listingId;
  const parsed = parseBooking(values);
  const errors = parsed.errors ?? {};
  const [licence] = images(formData, "licence");
  if (!licence) errors.licence = ["Joignez une photo de votre permis de conduire."];
  else if (licence.size > MAX_PHOTO_BYTES) errors.licence = ["Le fichier doit peser moins de 8 Mo."];
  if (!parsed.data || errors.licence) return { errors, values };

  const listing = await prisma.listing.findFirst({
    where: { id: listingId, status: "PUBLISHED", kind: "RENT", sellerId: { not: user.id } },
    include: { seller: true },
  });
  if (!listing) return { errors: { form: ["Ce véhicule n'est plus proposé à la location."] }, values };

  const { startDate, endDate, days, renterFullName, licenceNumber } = parsed.data;
  if (await prisma.booking.findFirst({ where: dayOverlap(listingId, startDate, endDate) })) {
    return { errors: { startDate: ["Le véhicule est déjà réservé sur ces dates."] }, values };
  }
  const open = await prisma.booking.count({ where: { renterId: user.id, status: "REQUESTED" } });
  if (open >= MAX_OPEN_REQUESTS) {
    return { errors: { form: ["Vous avez déjà 5 demandes en attente de réponse."] }, values };
  }

  let licenceIds: string[];
  try {
    licenceIds = await storePhotos([licence]);
  } catch {
    return { errors: { licence: unreadableImage }, values };
  }
  let booking;
  try {
    booking = await prisma.booking.create({
      data: {
        listingId,
        renterId: user.id,
        startDate,
        endDate,
        days,
        pricePerDayFcfa: listing.priceFcfa,
        totalFcfa: listing.priceFcfa * days,
        depositFcfa: listing.depositFcfa ?? 0,
        renterFullName,
        licenceNumber,
        documents: { create: licenceIds.map((id) => ({ id, kind: "LICENCE" as const })) },
      },
    });
  } catch (e) {
    await deletePhotos(licenceIds);
    throw e;
  }
  await audit("rental.requested", user.id, booking.id);
  await notify(
    listing.seller.email,
    `Demande de location pour votre ${listing.brand} ${listing.model}`,
    `Vous avez reçu une demande de location. Répondez ici : ${link(booking.id)}`,
  );
  redirect(`/locations/${booking.id}`);
}

/** The owner accepts or declines a request. Accepting freezes the contract. */
export async function decideBooking(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const party = await partyOf(String(formData.get("id")), user.id);
  if (!party?.isOwner || party.booking.status !== "REQUESTED") return fail("Cette demande n'attend plus de réponse.");
  const { booking } = party;
  const { listing } = booking;
  const accept = formData.get("decision") === "accept";

  if (accept) {
    const contract = contractText({
      ownerName: listing.seller.sellerProfile?.fullName ?? "Le loueur",
      renterName: booking.renterFullName,
      licenceNumber: booking.licenceNumber,
      vehicle: `${listing.brand} ${listing.model} ${listing.year}`,
      startDate: booking.startDate,
      endDate: booking.endDate,
      days: booking.days,
      pricePerDayFcfa: booking.pricePerDayFcfa,
      totalFcfa: booking.totalFcfa,
      depositFcfa: booking.depositFcfa,
      kmPerDay: listing.kmPerDay ?? 0,
      zone: listing.zone ?? "",
    });
    // Serializable: two requests for the same days cannot both be accepted, even at the same instant.
    const accepted = await prisma.$transaction(
      async (tx) => {
        if (await tx.booking.findFirst({ where: dayOverlap(listing.id, booking.startDate, booking.endDate) })) {
          return false;
        }
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: "ACCEPTED",
            contractText: contract,
            contractHash: createHash("sha256").update(contract).digest("hex"),
          },
        });
        return true;
      },
      { isolationLevel: "Serializable" },
    );
    if (!accepted) return fail("Le véhicule est déjà réservé sur ces dates. Refusez cette demande.");
  } else {
    await prisma.booking.update({ where: { id: booking.id }, data: { status: "DECLINED" } });
  }
  await audit(accept ? "rental.accepted" : "rental.declined", user.id, booking.id);
  await notify(
    booking.renter.email,
    accept ? "Votre demande de location est acceptée" : "Votre demande de location n'a pas été retenue",
    accept ? `Lisez et signez le contrat ici : ${link(booking.id)}` : `Détail : ${link(booking.id)}`,
  );
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Either side cancels, free of charge, as long as the vehicle has not left. */
export async function cancelBooking(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const party = await partyOf(String(formData.get("id")), user.id);
  if (!party) return fail("Cette location est introuvable.");
  const { booking, isOwner } = party;
  const { count } = await prisma.booking.updateMany({
    where: { id: booking.id, status: { in: ["REQUESTED", "ACCEPTED", "SIGNED"] } },
    data: { status: "CANCELLED" },
  });
  if (!count) return fail("Cette location ne peut plus être annulée : le véhicule est parti.");
  await audit("rental.cancelled", user.id, booking.id);
  await notify(
    (isOwner ? booking.renter : booking.listing.seller).email,
    "Une location a été annulée",
    `Détail : ${link(booking.id)}`,
  );
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Each side signs the frozen contract; the renter also consents, separately, to GPS tracking. */
export async function signContract(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const party = await partyOf(String(formData.get("id")), user.id);
  if (!party || party.booking.status !== "ACCEPTED") return fail("Ce contrat n'est pas à signer.");
  const { booking, isOwner } = party;
  if (formData.get("agree") !== "on") return fail("Cochez la case pour accepter le contrat.");
  if (!isOwner && formData.get("tracking") !== "on") {
    return fail("La location de ce véhicule suppose d'accepter sa géolocalisation.");
  }

  const now = new Date();
  const signed = await prisma.booking.update({
    where: { id: booking.id },
    data: isOwner ? { ownerSignedAt: now } : { renterSignedAt: now, trackingConsentAt: now },
  });
  if (signed.ownerSignedAt && signed.renterSignedAt) {
    await prisma.booking.updateMany({ where: { id: booking.id, status: "ACCEPTED" }, data: { status: "SIGNED" } });
  }
  // The audit line ties the signer, the time, the address and the exact text signed.
  await audit(`rental.signed.${isOwner ? "owner" : "renter"}.${booking.contractHash}`, user.id, booking.id);
  await notify(
    (isOwner ? booking.renter : booking.listing.seller).email,
    "Le contrat de location a été signé par l'autre partie",
    `Suite de la location : ${link(booking.id)}`,
  );
  revalidatePath("/", "layout");
  return { ok: true };
}

/** AVS Rental Check: the owner records the state of the vehicle at departure, then at return. */
export async function saveInspection(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const values = text(formData);
  const party = await partyOf(values.id, user.id);
  const phase =
    party?.booking.status === "SIGNED" ? "DEPARTURE" : party?.booking.status === "ACTIVE" ? "RETURN" : null;
  if (!party?.isOwner || !phase) return { ...fail("Aucun état des lieux n'est attendu pour cette location."), values };
  const { booking } = party;

  const parsed = inspectionInput.safeParse(values);
  const errors: FormState["errors"] = parsed.success ? {} : z.flattenError(parsed.error).fieldErrors;
  const photos = images(formData, "photos");
  if (photos.length < 1 || photos.length > MAX_PHOTOS) errors.photos = [`Ajoutez entre 1 et ${MAX_PHOTOS} photos.`];
  else if (photos.some((f) => f.size > MAX_PHOTO_BYTES)) errors.photos = ["Chaque photo doit peser moins de 8 Mo."];
  if (!parsed.success || errors.photos) return { errors, values };

  const existing = await prisma.inspection.findMany({ where: { bookingId: booking.id }, include: { documents: true } });
  const departure = existing.find((i) => i.phase === "DEPARTURE");
  const previous = existing.find((i) => i.phase === phase);
  if (previous?.confirmedAt) return { ...fail("Cet état des lieux a déjà été confirmé par le locataire."), values };
  if (phase === "RETURN" && departure && parsed.data.mileageKm < departure.mileageKm) {
    return { errors: { mileageKm: ["Le kilométrage de retour est inférieur à celui du départ."] }, values };
  }

  let photoIds: string[];
  try {
    photoIds = await storePhotos(photos);
  } catch {
    return { errors: { photos: unreadableImage }, values };
  }
  const data = {
    ...parsed.data,
    depositDone: values.depositDone === "on",
    documents: { create: photoIds.map((id, position) => ({ id, position, kind: "INSPECTION" as const })) },
  };
  try {
    // The owner may redo an inspection until the renter confirms it; the earlier photos are replaced.
    await prisma.$transaction([
      prisma.document.deleteMany({ where: { inspectionId: previous?.id ?? "" } }),
      prisma.inspection.upsert({
        where: { bookingId_phase: { bookingId: booking.id, phase } },
        create: { ...data, bookingId: booking.id, phase },
        update: { ...data, createdAt: new Date() },
      }),
    ]);
  } catch (e) {
    await deletePhotos(photoIds);
    throw e;
  }
  await deletePhotos(previous?.documents.map((d) => d.id) ?? []);
  await notify(
    booking.renter.email,
    phase === "DEPARTURE" ? "État des lieux de départ à confirmer" : "État des lieux de retour à confirmer",
    `Vérifiez et confirmez l'état des lieux ici : ${link(booking.id)}`,
  );
  revalidatePath("/", "layout");
  return { ok: true };
}

/** The renter confirms an inspection: at departure the rental starts, at return it is closed. */
export async function confirmInspection(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const party = await partyOf(String(formData.get("id")), user.id);
  if (!party || party.isOwner) return fail("Seul le locataire confirme un état des lieux.");
  const { booking } = party;
  const phase = booking.status === "SIGNED" ? "DEPARTURE" : booking.status === "ACTIVE" ? "RETURN" : null;
  const now = new Date();
  const { count } = phase
    ? await prisma.inspection.updateMany({
        where: { bookingId: booking.id, phase, confirmedAt: null },
        data: { confirmedAt: now },
      })
    : { count: 0 };
  if (!phase || !count) return fail("Aucun état des lieux n'attend votre confirmation.");

  await prisma.booking.update({
    where: { id: booking.id },
    data: phase === "DEPARTURE" ? { status: "ACTIVE" } : { status: "CLOSED", closedAt: now },
  });
  await audit(phase === "DEPARTURE" ? "rental.departed" : "rental.closed", user.id, booking.id);
  await notify(
    booking.listing.seller.email,
    phase === "DEPARTURE" ? "Le locataire a confirmé le départ" : "La location est clôturée",
    `Détail : ${link(booking.id)}`,
  );
  revalidatePath("/", "layout");
  return { ok: true };
}
