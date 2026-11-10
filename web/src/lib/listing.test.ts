import assert from "node:assert/strict";
import { test } from "node:test";
import { formatPrice, listingInput, maskVin, sellerProfileInput } from "./listing.ts";

const valid = {
  category: "VOITURE",
  brand: " Toyota ",
  model: "Corolla",
  year: "2020",
  mileageKm: "48 000",
  fuel: "Essence",
  transmission: "Automatique",
  priceFcfa: "9 800 000",
  commune: "Cocody",
  description: "Première main, entretien suivi, climatisation.",
  vin: "",
};

test("accepts a well-formed listing and normalises it", () => {
  const out = listingInput.parse(valid);
  assert.equal(out.brand, "Toyota");
  assert.equal(out.mileageKm, 48000);
  assert.equal(out.priceFcfa, 9800000);
  assert.equal(out.vin, null);
  assert.equal(listingInput.parse({ ...valid, vin: "jtdbr32e720123456" }).vin, "JTDBR32E720123456");
});

test("rejects incoherent values", () => {
  const bad = (patch: object) => listingInput.safeParse({ ...valid, ...patch }).success;
  assert.equal(bad({ year: "1900" }), false);
  assert.equal(bad({ year: String(new Date().getFullYear() + 2) }), false);
  assert.equal(bad({ mileageKm: "" }), false);
  assert.equal(bad({ mileageKm: "-5" }), false);
  assert.equal(bad({ priceFcfa: "100" }), false);
  assert.equal(bad({ priceFcfa: "9.8e6" }), false);
  assert.equal(bad({ commune: "Paris" }), false);
  assert.equal(bad({ category: "AVION" }), false);
  assert.equal(bad({ description: "Trop court" }), false);
  assert.equal(bad({ vin: "JTDBR32E72012345" }), false); // 16 characters
  assert.equal(bad({ vin: "JTDBR32E72012345O" }), false); // letter O
});

test("masks a VIN and formats a price", () => {
  assert.equal(maskVin("JTDBR32E720123456"), "JTDB•••••••••3456");
  assert.equal(formatPrice(9800000), "9 800 000 FCFA");
});

test("validates a seller identity", () => {
  const identity = { fullName: "Kouassi Awa Marie", yearsExperience: "7", matricule: "AG-2041", company: "Lagune Auto", position: "Conseillère commerciale" };
  assert.equal(sellerProfileInput.parse(identity).yearsExperience, 7);
  assert.equal(sellerProfileInput.safeParse({ ...identity, fullName: "A" }).success, false);
  assert.equal(sellerProfileInput.safeParse({ ...identity, yearsExperience: "75" }).success, false);
  assert.equal(sellerProfileInput.safeParse({ ...identity, matricule: " " }).success, false);
});
