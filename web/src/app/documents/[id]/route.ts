import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { photoPath } from "@/lib/photos";
import { getUser } from "@/lib/session";

const notFound = () => new Response(null, { status: 404 });

/** Private images: registration papers, insurance attestations, driving licences, inspection photos. Never public. */
export async function GET(request: Request, ctx: RouteContext<"/documents/[id]">) {
  const { id } = await ctx.params;
  const user = await getUser();
  if (!user) return notFound();

  const doc = await prisma.document.findUnique({
    where: { id },
    select: {
      listing: { select: { sellerId: true } },
      vehicle: { select: { ownerId: true } },
      booking: { select: { renterId: true, listing: { select: { sellerId: true } } } },
      inspection: { select: { booking: { select: { renterId: true, listing: { select: { sellerId: true } } } } } },
    },
  });
  if (!doc) return notFound();

  // An attestation belongs to the listing's owner; licences and inspection photos to the two parties.
  const booking = doc.booking ?? doc.inspection?.booking;
  const allowed = [doc.listing?.sellerId, doc.vehicle?.ownerId, booking?.renterId, booking?.listing.sellerId];
  if (user.role !== "admin" && !allowed.includes(user.id)) return notFound();

  const small = new URL(request.url).searchParams.has("s");
  const file = await readFile(photoPath(id, small)).catch(() => null);
  if (!file) return notFound();
  return new Response(new Uint8Array(file), {
    headers: { "content-type": "image/webp", "cache-control": "private, no-store" },
  });
}
