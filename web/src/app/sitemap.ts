import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { siteUrl } from "@/lib/mail";

/**
 * Every published listing, plus the search pages that have something to show: by type, and by
 * commune for each type. Empty pages are left out, so that Google does not see thin content.
 * shortcut: one sitemap of at most 50 000 addresses (Google's limit); split it into several past that.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [listings, places] = await Promise.all([
    prisma.listing.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true, publishedAt: true },
      orderBy: { publishedAt: "desc" },
      take: 49_000,
    }),
    prisma.listing.groupBy({ by: ["kind", "category", "commune"], where: { status: "PUBLISHED" } }),
  ]);
  const searches = new Set<string>();
  for (const p of places) {
    if (p.category === "PIECE") {
      searches.add("categorie=PIECE");
      searches.add(`categorie=PIECE&commune=${encodeURIComponent(p.commune)}`);
    } else {
      searches.add(`type=${p.kind}`);
      searches.add(`type=${p.kind}&commune=${encodeURIComponent(p.commune)}`);
    }
  }
  return [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
    ...[...searches].map((q) => ({ url: `${siteUrl}/annonces?${q}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...listings.map((l) => ({ url: `${siteUrl}/annonces/${l.id}`, lastModified: l.publishedAt ?? undefined, priority: 0.6 })),
  ];
}
