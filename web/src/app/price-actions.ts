"use server";

import { CATEGORIES } from "@/lib/listing";
import { comparablePrices } from "@/lib/listing-checks";
import { usualPriceText } from "@/lib/pricing";
import { requireUser } from "@/lib/session";

/** The usual price of listings comparable to the one being written, for the seller to compare with. */
export async function estimatePrice(formData: FormData): Promise<string> {
  await requireUser();
  const get = (name: string) => String(formData.get(name) ?? "").trim();
  const kind = get("kind") === "RENT" ? "RENT" : "SALE";
  const category = get("category");
  const year = Number(get("year"));
  // Parts have no year to compare on; the button is not shown for them.
  const isVehicle = category in CATEGORIES && category !== "PIECE";
  if (!isVehicle || !get("brand") || !get("model") || !Number.isInteger(year) || year < 1950 || year > 2100) {
    return "Indiquez d'abord la catégorie, la marque, le modèle et l'année.";
  }
  const prices = await comparablePrices({
    kind,
    category: category as "VOITURE" | "MOTO" | "UTILITAIRE",
    brand: get("brand").slice(0, 40),
    model: get("model").slice(0, 60),
    year,
  });
  return (
    usualPriceText(prices, kind === "RENT") ??
    "Pas encore assez d'annonces comparables sur MonAuto pour donner un prix habituel (il en faut 3)."
  );
}
