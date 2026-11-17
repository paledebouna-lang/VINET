import sharp from "sharp";
import { formatPrice } from "./listing.ts";
import { median } from "./pilot.ts";

/** The checks behind the moderation warnings. They inform the team; they decide nothing alone. */

const PRICE_RATIO = 0.5;
const MIN_COMPARABLES = 3;
// Two photos this close (out of 64 bits) are the same picture, resized or recompressed.
// shortcut: a cropped copy, or one with borders added, is not recognised; compare image features if that becomes common.
export const SAME_PHOTO_DISTANCE = 10;

const N = 32;
// Standard deviation of the grey thumbnail below which a picture is considered plain.
const MIN_DETAIL = 4;
// Cosines of the 2D DCT for the 8 lowest frequencies, computed once.
const COS = Array.from({ length: 8 }, (_, u) => Array.from({ length: N }, (_, x) => Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N))));

/**
 * Perceptual hash of a picture (pHash): the 64 lowest frequencies of a 32×32 grey thumbnail,
 * each compared to their median. Survives resizing and recompression; measured on photo-like
 * pictures, copies differ by 6 bits at most and different photos by 24 or more. Null for a plain picture.
 */
export async function photoHash(image: string | Buffer) {
  const pixels = await sharp(image).grayscale().resize(N, N, { fit: "fill" }).raw().toBuffer();
  // A picture without detail (a plain colour) has no meaningful fingerprint: two of them would always match.
  const mean = pixels.reduce((sum, v) => sum + v, 0) / pixels.length;
  if (Math.sqrt(pixels.reduce((sum, v) => sum + (v - mean) ** 2, 0) / pixels.length) < MIN_DETAIL) return null;
  const freq: number[] = [];
  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 8; v++) {
      let sum = 0;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) sum += pixels[y * N + x] * COS[u][x] * COS[v][y];
      freq.push(sum);
    }
  }
  // The first value is the average brightness: left out of the median, so that it does not decide alone.
  const median = [...freq.slice(1)].sort((a, b) => a - b)[31];
  let bits = BigInt(0);
  for (const f of freq) bits = (bits << BigInt(1)) | BigInt(f > median ? 1 : 0);
  return bits.toString(16).padStart(16, "0");
}

export function hamming(a: string, b: string) {
  let diff = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let count = 0;
  for (; diff; diff &= diff - BigInt(1)) count++;
  return count;
}

/** A description reduced to its words, so that spacing, case and accents do not hide a copy. */
export const normalizeText = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** The warning for a price far below comparable listings, or null with too few to compare. */
export function priceWarning(price: number, comparablePrices: number[]) {
  const usual = median(comparablePrices);
  if (usual === null || comparablePrices.length < MIN_COMPARABLES || price >= usual * PRICE_RATIO) return null;
  return `Prix très bas : ${formatPrice(price)}, pour un prix habituel de ${formatPrice(Math.round(usual))} (${comparablePrices.length} annonces comparables).`;
}
