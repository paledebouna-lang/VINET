import Link from "next/link";
import { prisma } from "@/lib/db";
import { CATEGORIES, formatNumber, formatPrice, listingTitle } from "@/lib/listing";

export const instant = false;

const MAX_COMPARED = 4;

export default async function Comparer({ searchParams }: PageProps<"/comparer">) {
  const { id } = await searchParams;
  const ids = (Array.isArray(id) ? id : id ? [id] : []).slice(0, MAX_COMPARED);
  const found = await prisma.listing.findMany({
    where: { id: { in: ids }, status: "PUBLISHED" },
    include: { photos: { orderBy: { position: "asc" }, take: 1 } },
  });
  // Keep the order the user picked.
  const listings = ids.flatMap((i) => found.filter((l) => l.id === i));

  if (listings.length < 2) {
    return (
      <div className="section wrap medium">
        <h1 className="page-title">Comparer des annonces</h1>
        <p className="muted">
          Cochez deux à quatre annonces dans <Link href="/favoris">vos favoris</Link>, puis lancez la
          comparaison.
        </p>
      </div>
    );
  }

  const cheapest = Math.min(...listings.map((l) => l.priceFcfa));
  // Parts have neither mileage nor year: they are left out of those two "best" marks.
  const lowestKm = Math.min(...listings.flatMap((l) => (l.mileageKm === null ? [] : [l.mileageKm])));
  const newest = Math.max(...listings.flatMap((l) => (l.year === null ? [] : [l.year])));
  const dash = "—";
  // The best value of a row is marked in words as well as in bold, so it does not rely on styling.
  const best = (isBest: boolean, text: string, label: string) =>
    isBest ? (
      <strong>
        {text} <span className="status status-published">{label}</span>
      </strong>
    ) : (
      text
    );

  const rows: [string, (l: (typeof listings)[number]) => React.ReactNode][] = [
    ["Prix", (l) => best(l.priceFcfa === cheapest, formatPrice(l.priceFcfa), "le moins cher")],
    ["Année", (l) => (l.year === null ? dash : best(l.year === newest, String(l.year), "le plus récent"))],
    [
      "Kilométrage",
      (l) => (l.mileageKm === null ? dash : best(l.mileageKm === lowestKm, `${formatNumber(l.mileageKm)} km`, "le moins roulé")),
    ],
    ["Catégorie", (l) => CATEGORIES[l.category]],
    ["Énergie", (l) => l.fuel ?? dash],
    ["Boîte", (l) => l.transmission ?? dash],
    ["État de la pièce", (l) => l.partCondition ?? dash],
    ["Commune", (l) => l.commune],
  ];

  return (
    <div className="section wrap">
      <h1 className="page-title">Comparer des annonces</h1>
      <div className="table-scroll">
        <table className="compare">
          <thead>
            <tr>
              <td></td>
              {listings.map((l) => (
                <th key={l.id} scope="col">
                  {l.photos[0] && <img src={`/photos/${l.photos[0].id}?s`} alt="" />}
                  <Link href={`/annonces/${l.id}`}>
                    {listingTitle(l)}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, cell]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                {listings.map((l) => (
                  <td key={l.id}>{cell(l)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
