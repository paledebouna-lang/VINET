import { prisma } from "./db";
import { SAME_PHOTO_DISTANCE, hamming, normalizeText, photoHash, priceWarning } from "./fraud";
import { siteUrl } from "./mail";
import { photoPath } from "./photos";
import { caseReference } from "./security";
import { notifyTeam } from "./team";

const YEAR_MS = 365 * 86_400_000;
// A copied description must be long enough to mean something: "Très bon état." is not a copy.
const MIN_COPIED_TEXT = 40;
const OPEN = ["PENDING", "PUBLISHED"] as const;

/** Computes and stores a photo's fingerprint; a file that cannot be read is skipped. */
async function fingerprint(photoId: string) {
  const phash = await photoHash(photoPath(photoId, true)).catch(() => null);
  if (phash) await prisma.listingPhoto.update({ where: { id: photoId }, data: { phash } });
  return phash;
}

/**
 * Checks a listing just submitted and stores the warnings the moderators will read. Nothing is
 * refused here: the team decides. Comparisons are against other sellers' listings only.
 * shortcut: compares in memory with every open listing; move descriptions and photos to indexed lookups past ~20 000 listings.
 */
export async function checkListing(listingId: string) {
  const listing = await prisma.listing.findUniqueOrThrow({ where: { id: listingId }, include: { photos: true } });
  const others = { id: { not: listing.id }, sellerId: { not: listing.sellerId }, status: { in: [...OPEN] } };
  const flags: string[] = [];

  if (listing.vin) {
    const stolen = await prisma.theftCase.findFirst({ where: { status: "ACTIVE", vehicle: { serial: listing.vin } } });
    if (stolen) {
      flags.push(`Numéro de série d'un véhicule déclaré volé (dossier ${caseReference(stolen.number)}) : la publication est bloquée.`);
      await notifyTeam(`${caseReference(stolen.number)} : annonce déposée pour le véhicule volé`, `${siteUrl}/admin/dossiers/${stolen.id}`);
    }
    if (await prisma.listing.count({ where: { ...others, vin: listing.vin } })) {
      flags.push("Numéro de série déjà utilisé dans l'annonce d'un autre vendeur.");
    }
  }

  if (listing.category !== "PIECE" && listing.year !== null) {
    const comparables = await prisma.listing.findMany({
      where: {
        id: { not: listing.id },
        status: "PUBLISHED",
        kind: listing.kind,
        category: listing.category,
        brand: { equals: listing.brand, mode: "insensitive" },
        model: { equals: listing.model, mode: "insensitive" },
        year: { gte: listing.year - 2, lte: listing.year + 2 },
        publishedAt: { gte: new Date(Date.now() - YEAR_MS) },
      },
      select: { priceFcfa: true },
      take: 200,
    });
    const warning = priceWarning(listing.priceFcfa, comparables.map((c) => c.priceFcfa));
    if (warning) flags.push(warning);
  }

  const text = normalizeText(listing.description);
  if (text.length >= MIN_COPIED_TEXT) {
    const descriptions = await prisma.listing.findMany({ where: others, select: { description: true } });
    if (descriptions.some((d) => normalizeText(d.description) === text)) {
      flags.push("Description identique à celle de l'annonce d'un autre vendeur.");
    }
  }

  // Fingerprints of this listing's new photos, and of a few older ones stored before fingerprints existed.
  const older = await prisma.listingPhoto.findMany({
    where: { phash: null, listingId: { not: listing.id }, listing: { status: { in: [...OPEN] } } },
    take: 50,
  });
  await Promise.all(older.map((p) => fingerprint(p.id)));
  const hashes = await Promise.all(listing.photos.map((p) => p.phash ?? fingerprint(p.id)));
  const mine = hashes.filter((h): h is string => h !== null);
  if (mine.length) {
    const theirs = await prisma.listingPhoto.findMany({ where: { phash: { not: null }, listing: others }, select: { phash: true } });
    if (theirs.some((t) => mine.some((h) => hamming(h, t.phash!) <= SAME_PHOTO_DISTANCE))) {
      flags.push("Photo identique à une photo de l'annonce d'un autre vendeur.");
    }
  }

  // The site masks contact details as they are typed; the attempt is worth knowing.
  if (/\[(numéro|e-mail) masqué\]/.test(`${listing.brand} ${listing.model} ${listing.partName ?? ""} ${listing.description}`)) {
    flags.push("Le vendeur a tenté d'afficher un numéro de téléphone ou une adresse e-mail.");
  }

  await prisma.listing.update({ where: { id: listing.id }, data: { riskFlags: flags } });
  return flags;
}
