import { prisma } from "@/lib/db";
import { CATEGORIES, COMMUNES, type CategoryKey } from "@/lib/listing";
import { ListingGrid, cardSelect } from "../listing-card";

export const instant = false;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

export default async function Annonces({ searchParams }: PageProps<"/annonces">) {
  const params = await searchParams;
  const q = first(params.q).slice(0, 60);
  // Anything not in the lists is ignored rather than trusted.
  const category = first(params.categorie) in CATEGORIES ? (first(params.categorie) as CategoryKey) : undefined;
  const commune = COMMUNES.find((c) => c === first(params.commune));
  const maxPrice = /^\d{1,10}$/.test(first(params.prixMax)) ? Number(first(params.prixMax)) : undefined;

  // shortcut: substring match on brand and model; move to full-text search past a few thousand listings.
  const words = q.split(/\s+/).filter(Boolean);
  const listings = await prisma.listing.findMany({
    where: {
      status: "PUBLISHED",
      category,
      commune,
      priceFcfa: maxPrice === undefined ? undefined : { lte: maxPrice },
      AND: words.map((word) => ({
        OR: [
          { brand: { contains: word, mode: "insensitive" as const } },
          { model: { contains: word, mode: "insensitive" as const } },
        ],
      })),
    },
    orderBy: { publishedAt: "desc" },
    take: 60,
    select: cardSelect,
  });

  return (
    <div className="section wrap">
      <h1 className="page-title">Acheter un véhicule</h1>
      <form className="search card">
        <div className="field grow">
          <label htmlFor="q">Marque ou modèle</label>
          <input id="q" name="q" defaultValue={q} placeholder="Toyota, Hilux, MT-07…" />
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
          <label htmlFor="prixMax">Budget max (FCFA)</label>
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
