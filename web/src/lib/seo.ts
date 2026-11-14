import { CATEGORIES, type CategoryKey, type KindKey, formatNumber, formatPrice, listingTitle } from "./listing.ts";

/** How listings and searches are named in Google's results and in link previews. */

const NOUNS: Record<CategoryKey, string> = {
  VOITURE: "Voitures",
  MOTO: "Motos et scooters",
  UTILITAIRE: "Utilitaires",
  PIECE: "Pièces détachées",
};

/** "Voitures à vendre à Cocody, Abidjan": the heading and title of a search page. */
export function searchHeading(kind?: KindKey, category?: CategoryKey, commune?: string) {
  const place = commune ? `à ${commune}, Abidjan` : "à Abidjan";
  if (category === "PIECE") return `Pièces détachées ${place}`;
  const noun = category ? NOUNS[category] : "Véhicules";
  const what = kind === "RENT" ? "à louer" : kind === "SALE" ? "à vendre" : "à vendre et à louer";
  return `${noun} ${what} ${place}`;
}

type Seen = {
  id: string;
  kind: string;
  category: string;
  brand: string;
  model: string;
  year: number | null;
  mileageKm: number | null;
  fuel: string | null;
  transmission: string | null;
  partName: string | null;
  partCondition: string | null;
  priceFcfa: number;
  commune: string;
  description: string;
  photos: { id: string }[];
};

const clip = (text: string, max: number) => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
};

/** "Toyota Corolla 2020 à vendre à Cocody, Abidjan". */
export const listingHeadline = (l: Seen) =>
  `${listingTitle(l)} ${l.kind === "RENT" ? "à louer" : "à vendre"} à ${l.commune}, Abidjan`;

/** About 160 characters: the price and key facts first, then the seller's own words. */
export function listingDescription(l: Seen) {
  const facts =
    l.category === "PIECE"
      ? [l.partCondition && `pièce ${l.partCondition.toLowerCase()}`, `compatible ${l.brand} ${l.model}`]
      : [l.mileageKm !== null && `${formatNumber(l.mileageKm)} km`, l.fuel, l.transmission];
  const head = [`${formatPrice(l.priceFcfa)}${l.kind === "RENT" ? " par jour" : ""}`, ...facts.filter(Boolean)].join(" · ");
  return clip(`${head}. ${l.description}`, 160);
}

const SCHEMA_TYPES: Record<string, string> = { VOITURE: "Car", MOTO: "Motorcycle", UTILITAIRE: "Vehicle", PIECE: "Product" };
const CONDITIONS: Record<string, string> = {
  Neuve: "https://schema.org/NewCondition",
  Occasion: "https://schema.org/UsedCondition",
  Reconditionnée: "https://schema.org/RefurbishedCondition",
};

/** schema.org data Google reads to understand a listing: what it is, its price and where. */
export function listingJsonLd(l: Seen, siteUrl: string) {
  const url = `${siteUrl}/annonces/${l.id}`;
  const isPart = l.category === "PIECE";
  return {
    "@context": "https://schema.org",
    "@type": SCHEMA_TYPES[l.category] ?? "Product",
    name: listingTitle(l),
    description: clip(l.description, 500),
    url,
    image: l.photos.map((p) => `${siteUrl}/photos/${p.id}`),
    brand: { "@type": "Brand", name: l.brand },
    category: CATEGORIES[l.category as CategoryKey],
    ...(isPart
      ? { itemCondition: l.partCondition ? CONDITIONS[l.partCondition] : undefined }
      : {
          model: l.model,
          vehicleModelDate: l.year === null ? undefined : String(l.year),
          mileageFromOdometer:
            l.mileageKm === null ? undefined : { "@type": "QuantitativeValue", value: l.mileageKm, unitCode: "KMT" },
          fuelType: l.fuel ?? undefined,
          vehicleTransmission: l.transmission ?? undefined,
        }),
    offers: {
      "@type": "Offer",
      url,
      price: l.priceFcfa,
      priceCurrency: "XOF",
      availability: "https://schema.org/InStock",
      ...(l.kind === "RENT"
        ? { priceSpecification: { "@type": "UnitPriceSpecification", price: l.priceFcfa, priceCurrency: "XOF", unitText: "DAY" } }
        : {}),
      availableAtOrFrom: {
        "@type": "Place",
        address: { "@type": "PostalAddress", addressLocality: l.commune, addressRegion: "Abidjan", addressCountry: "CI" },
      },
    },
  };
}

/** JSON for a <script> tag: "<" is escaped so that a seller's text can never close the tag. */
export const jsonLdScript = (data: object) => JSON.stringify(data).replace(/</g, "\\u003c");
