import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { photoPath } from "@/lib/photos";
import { getUser } from "@/lib/session";

const notFound = () => new Response(null, { status: 404 });

export async function GET(request: Request, ctx: RouteContext<"/photos/[id]">) {
  const { id } = await ctx.params;
  // The id is only used as a file name after this lookup finds it, so it cannot leave UPLOAD_DIR.
  const photo = await prisma.listingPhoto.findUnique({
    where: { id },
    select: { listing: { select: { status: true, sellerId: true } } },
  });
  if (!photo) return notFound();

  const isPublic = photo.listing.status === "PUBLISHED";
  if (!isPublic) {
    const user = await getUser();
    if (!user || (user.id !== photo.listing.sellerId && user.role !== "admin")) return notFound();
  }

  const small = new URL(request.url).searchParams.has("s");
  const file = await readFile(photoPath(id, small)).catch(() => null);
  if (!file) return notFound();
  return new Response(new Uint8Array(file), {
    headers: {
      "content-type": "image/webp",
      "cache-control": isPublic ? "public, max-age=31536000, immutable" : "private, no-store",
    },
  });
}
