import { formatPrice } from "./listing.ts";
import { median } from "./pilot.ts";

const MIN_COMPARABLES = 3;

// Value at a fraction of the way through sorted prices, between neighbours when it falls between two.
function quantile(sorted: number[], q: number) {
  const at = (sorted.length - 1) * q;
  const below = Math.floor(at);
  return sorted[below] + (sorted[Math.min(below + 1, sorted.length - 1)] - sorted[below]) * (at - below);
}

/** The usual price of comparable listings and the range of the middle half of them, or null with too few. */
export function usualPrice(prices: number[]) {
  if (prices.length < MIN_COMPARABLES) return null;
  const sorted = [...prices].sort((a, b) => a - b);
  // Rounded to the thousand: a sharper figure would claim more precision than a handful of listings gives.
  const round = (n: number) => Math.round(n / 1000) * 1000;
  return { median: round(median(sorted)!), low: round(quantile(sorted, 0.25)), high: round(quantile(sorted, 0.75)), count: prices.length };
}

/** The sentence shown to a seller. */
export function usualPriceText(prices: number[], perDay: boolean) {
  const usual = usualPrice(prices);
  if (!usual) return null;
  const unit = perDay ? " par jour" : "";
  return `Prix habituel : ${formatPrice(usual.median)}${unit}. La moitié des ${usual.count} annonces comparables publiées cette année se situe entre ${formatPrice(usual.low)} et ${formatPrice(usual.high)}${unit}.`;
}
