import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { SAME_PHOTO_DISTANCE, hamming, photoHash, normalizeText, priceWarning } from "./fraud.ts";

// A photo-like picture drawn from a formula (sky, road, a car body with windows and wheels, noise),
// so that the test needs no file. `shift` moves the car: another photo of the same kind of scene.
const W = 600;
const H = 450;
function scene(shift: number, seed = 7, sky = 140) {
  const noise = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648) * 30 - 15;
  const raw = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const body = x > 125 + shift && x < 475 + shift && y > 210 && y < 350;
      const window = x > 190 + shift && x < 410 + shift && y > 220 && y < 270;
      const wheel = (x - 190 - shift) ** 2 + (y - 360) ** 2 < 1600 || (x - 410 - shift) ** 2 + (y - 360) ** 2 < 1600;
      const v = y < 190 ? sky + y / 4 : wheel ? 20 : window ? 60 : body ? 210 : 90 + (x % 40 < 20 ? 10 : 0);
      const n = noise();
      raw[(y * W + x) * 3] = Math.max(0, Math.min(255, v + n + (body ? 30 : 0)));
      raw[(y * W + x) * 3 + 1] = Math.max(0, Math.min(255, v + n));
      raw[(y * W + x) * 3 + 2] = Math.max(0, Math.min(255, v + n + (y < 190 ? 60 : body ? -60 : 0)));
    }
  }
  return sharp(raw, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();
}
// What the site stores for an upload: the 480 px WebP the hash is computed on.
const stored = async (input: Buffer) =>
  sharp(await sharp(input).resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer())
    .resize(480, 480, { fit: "inside" })
    .webp({ quality: 70 })
    .toBuffer();

test("a copied photo is recognised, re-uploaded or recompressed; another photo is not", async () => {
  for (const [shift, seed, sky] of [[0, 7, 140], [0, 11, 100], [40, 3, 170]]) {
    const original = await scene(shift, seed, sky);
    const published = await stored(original);
    const [a, reuploaded, recompressed, other] = await Promise.all([
      photoHash(published),
      photoHash(await stored(published)),
      photoHash(await stored(await sharp(original).resize(300).jpeg({ quality: 50 }).toBuffer())),
      photoHash(await stored(await scene(shift + 90, seed + 1, sky))),
    ]);
    assert.ok(a && reuploaded && recompressed && other, "photo-like pictures have a fingerprint");
    assert.match(a, /^[0-9a-f]{16}$/);
    assert.ok(hamming(a, reuploaded) <= SAME_PHOTO_DISTANCE, `re-uploaded ${hamming(a, reuploaded)}`);
    assert.ok(hamming(a, recompressed) <= SAME_PHOTO_DISTANCE, `recompressed ${hamming(a, recompressed)}`);
    assert.ok(hamming(a, other) > SAME_PHOTO_DISTANCE + 5, `other ${hamming(a, other)}`);
  }
  assert.equal(hamming("ffffffffffffffff", "0000000000000000"), 64);
});

test("a plain picture has no fingerprint, so two plain pictures never match", async () => {
  const plain = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#8b8b8b" } }).png().toBuffer();
  assert.equal(await photoHash(plain), null);
});

test("copied descriptions match despite case, accents and spacing", () => {
  assert.equal(normalizeText("  Première MAIN,   très   propre !"), normalizeText("premiere main tres propre"));
  assert.notEqual(normalizeText("Première main"), normalizeText("Deuxième main"));
});

test("a price far below comparable listings is flagged, with enough of them only", () => {
  assert.equal(priceWarning(3_000_000, [9_000_000, 9_500_000]), null);
  assert.equal(priceWarning(5_000_000, [9_000_000, 9_500_000, 10_000_000]), null);
  assert.equal(
    priceWarning(3_000_000, [9_000_000, 9_500_000, 10_000_000]),
    "Prix très bas : 3 000 000 FCFA, pour un prix habituel de 9 500 000 FCFA (3 annonces comparables).",
  );
});
