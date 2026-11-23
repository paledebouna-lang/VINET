import assert from "node:assert/strict";
import { test } from "node:test";
import { usualPrice, usualPriceText } from "./pricing.ts";

test("usual price and middle range, only with enough comparables", () => {
  assert.equal(usualPrice([9_000_000, 9_500_000]), null);
  assert.deepEqual(usualPrice([10_000_000, 9_000_000, 9_500_000, 9_800_000]), { median: 9_650_000, low: 9_375_000, high: 9_850_000, count: 4 });
  assert.deepEqual(usualPrice([45_000, 40_000, 50_000]), { median: 45_000, low: 43_000, high: 48_000, count: 3 });
});

test("the sentence a seller reads", () => {
  assert.equal(usualPriceText([1, 2], false), null);
  assert.equal(
    usualPriceText([40_000, 45_000, 50_000], true),
    "Prix habituel : 45 000 FCFA par jour. La moitié des 3 annonces comparables publiées cette année se situe entre 43 000 FCFA et 48 000 FCFA par jour.",
  );
});
