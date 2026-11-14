import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { CATEGORIES, COMMUNES, type CategoryKey, type KindKey } from "@/lib/listing";
import { searchHeading } from "@/lib/seo";
import { ListingGrid, cardSelect } from "../listing-card";

export const instant = false;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

// Anything not in the lists is ignored rather than trusted.
function readFilters(params: Record<string, string | string[] | undefined>) {
  return {
    category: first(params.categorie) in CATEGORIES ? (first(params.categorie) as CategoryKey) : undefined,
    kind: ["SALE", "RENT"].includes(first(params.type)) ? (first(params.type) as KindKey) : undefined,
    commune: COMMUNES.find((c) => c === first(params.commune)),
  };
}

export async function generateMetadata({ searchParams }: PageProps<"/annonces">): Promise<Metadata> {
  const params = await searchParams;
  const { category, kind, commune } = readFilters(params);
  // One address per kind of search: free text and price limits point back to it.
  const canonical = new URLSearchParams();
  if (kind && category !== "PIECE") canonical.set("type", kind);
  if (category) canonical.set("categorie", category);
  if (commune) canonical.set("commune", commune);
  const count = await prisma.listing.count({
    where: { status: "PUBLISHED", kind: category === "PIECE" ? undefined : kind, category, commune },
  });
  const title = searchHeading(kind, category, commune);
  return {
    title,
    description: `${count} annonce${count > 1 ? "s" : ""} : ${title.charAt(0).toLowerCase()}${title.slice(1)}. Vendeurs vérifiés, échanges sur MonAuto, passeport numérique AVS.`,
    alternates: { canonical: `/annonces${canonical.size ? `?${canonical}` : ""}` },
    // An empty search page is not worth a place in Google; its links still are.
    robots: count ? undefined : { index: false, follow: true },
  };
}

export default async function Annonces({ searchParams }: PageProps<"/annonces">) {
  const params = await searchParams;
  const q = first(params.q).slice(0, 60);
  const { category, kind, commune } = readFilters(params);
  const maxPrice = /^\d{1,10}$/.test(first(params.prixMax)) ? Number(first(params.prixMax)) : undefined;

  // shortcut: substring match on brand, model and part name or reference; move to full-text search past a few thousand listings.
  const words = q.split(/\s+/).filter(Boolean);
  const listings = await prisma.listing.findMany({
    where: {
      status: "PUBLISHED",
      kind,
      category,
      commune,
      priceFcfa: maxPrice === undefined ? undefined : { lte: maxPrice },
      AND: words.map((word) => ({
        OR: [
          { brand: { contains: word, mode: "insensitive" as const } },
          { model: { contains: word, mode: "insensitive" as const } },
          { partName: { contains: word, mode: "insensitive" as const } },
          { partReference: { contains: word, mode: "insensitive" as const } },
        ],
      })),
    },
    orderBy: { publishedAt: "desc" },
    take: 60,
    select: cardSelect,
  });

  return (
    <div className="section wrap">
      <h1 className="page-title">
        {searchHeading(kind, category, commune)}
      </h1>
      <form className="search card">
        <div className="field">
          <label htmlFor="type">Type</label>
          <select id="type" name="type" defaultValue={kind ?? ""}>
            <option value="">Vente et location</option>
            <option value="SALE">À vendre</option>
            <option value="RENT">À louer</option>
          </select>
        </div>
        <div className="field grow">
          <label htmlFor="q">Marque, modèle, pièce ou référence</label>
          <input id="q" name="q" defaultValue={q} placeholder="Toyota, Hilux, alternateur…" />
        </div>
        <div className="field">
          <label htmlFor="categorie">Catégorie</label>
          <select id="categorie" name="categorie" defaultValue={category ?? ""}>
            <option value="">Toutes</option>
            {Object.entries(CATEGORIES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="commune">Commune</label>
          <select id="commune" name="commune" defaultValue={commune ?? ""}>
            <option value="">Toutes</option>
            {COMMUNES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="prixMax">Prix max (FCFA)</label>
          <input id="prixMax" name="prixMax" inputMode="numeric" pattern="\d*" defaultValue={maxPrice ?? ""} />
        </div>
        <button className="btn btn-primary">Rechercher</button>
      </form>

      <p className="muted" role="status">
        {listings.length === 0
          ? "Aucune annonce ne correspond. Élargissez votre recherche."
          : `${listings.length} annonce${listings.length > 1 ? "s" : ""}`}
      </p>
      <ListingGrid listings={listings} />
    </div>
  );
}
