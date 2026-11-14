import assert from "node:assert/strict";
import { test } from "node:test";
import { jsonLdScript, listingDescription, listingHeadline, listingJsonLd, searchHeading } from "./seo.ts";

const car = {
  id: "c1", kind: "SALE", category: "VOITURE", brand: "Toyota", model: "Corolla", year: 2020, mileageKm: 48000,
  fuel: "Essence", transmission: "Automatique", partName: null, partCondition: null, priceFcfa: 9800000,
  commune: "Cocody", description: "Première main, entretien suivi chez le concessionnaire, climatisation, jantes alliage, aucun accident. ".repeat(3),
  photos: [{ id: "p1" }, { id: "p2" }],
};

test("search headings name the place and what is on offer", () => {
  assert.equal(searchHeading(), "Véhicules à vendre et à louer à Abidjan");
  assert.equal(searchHeading("SALE", "VOITURE", "Cocody"), "Voitures à vendre à Cocody, Abidjan");
  assert.equal(searchHeading("RENT", "UTILITAIRE"), "Utilitaires à louer à Abidjan");
  assert.equal(searchHeading("SALE", "PIECE", "Adjamé"), "Pièces détachées à Adjamé, Abidjan");
});

test("a listing's title and description in Google", () => {
  assert.equal(listingHeadline(car), "Toyota Corolla 2020 à vendre à Cocody, Abidjan");
  const d = listingDescription(car);
  assert.ok(d.startsWith("9 800 000 FCFA · 48 000 km · Essence · Automatique. Première main"));
  assert.ok(d.length <= 160 && d.endsWith("…"));
  const rent = listingDescription({ ...car, kind: "RENT", priceFcfa: 45000, description: "Disponible le week-end." });
  assert.equal(rent, "45 000 FCFA par jour · 48 000 km · Essence · Automatique. Disponible le week-end.");
  const part = { ...car, category: "PIECE", year: null, mileageKm: null, fuel: null, transmission: null, partName: "Phare avant gauche", partCondition: "Occasion", model: "Corolla 2015 à 2019", priceFcfa: 35000, description: "Phare d'origine." };
  assert.equal(listingDescription(part), "35 000 FCFA · pièce occasion · compatible Toyota Corolla 2015 à 2019. Phare d'origine.");
});

test("structured data for a car, a rental and a part", () => {
  const ld = JSON.parse(JSON.stringify(listingJsonLd(car, "https://monauto.org")));
  assert.equal(ld["@type"], "Car");
  assert.equal(ld.offers.price, 9800000);
  assert.equal(ld.offers.priceCurrency, "XOF");
  assert.equal(ld.mileageFromOdometer.value, 48000);
  assert.deepEqual(ld.image, ["https://monauto.org/photos/p1", "https://monauto.org/photos/p2"]);
  assert.equal(ld.offers.availableAtOrFrom.address.addressLocality, "Cocody");
  const rent = JSON.parse(JSON.stringify(listingJsonLd({ ...car, kind: "RENT" }, "https://monauto.org")));
  assert.equal(rent.offers.priceSpecification.unitText, "DAY");
  const part = JSON.parse(JSON.stringify(listingJsonLd({ ...car, category: "PIECE", partCondition: "Neuve" }, "https://monauto.org")));
  assert.equal(part["@type"], "Product");
  assert.equal(part.itemCondition, "https://schema.org/NewCondition");
  assert.equal(part.mileageFromOdometer, undefined);
});

test("a seller's text cannot break out of the script tag", () => {
  const out = jsonLdScript(listingJsonLd({ ...car, description: "</script><script>alert(1)</script>" }, "https://monauto.org"));
  assert.ok(!out.includes("</script>"));
  assert.ok(out.includes("\\u003c/script>"));
});
