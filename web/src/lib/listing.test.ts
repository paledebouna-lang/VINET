import assert from "node:assert/strict";
import { test } from "node:test";
import { formatPrice, listingTitle, maskContacts, maskVin, matriculeOf, parseMatricule, parseListing, rentalInput, sellerProfileInput } from "./listing.ts";

const valid = {
  kind: "SALE",
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
  const out = parseListing(valid).data!;
  assert.equal(out.brand, "Toyota");
  assert.equal(out.mileageKm, 48000);
  assert.equal(out.priceFcfa, 9800000);
  assert.equal(out.vin, null);
  assert.equal(out.partName, null);
  assert.equal(parseListing({ ...valid, vin: "jtdbr32e720123456" }).data?.vin, "JTDBR32E720123456");
});

test("rejects incoherent values", () => {
  const bad = (patch: object) => !!parseListing({ ...valid, ...patch }).data;
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
  assert.equal(bad({ priceFcfa: "45 000" }), false); // too low for a sale
  assert.equal(bad({ kind: "RENT", priceFcfa: "45 000" }), true); // a fair daily rate
  assert.equal(bad({ kind: "GIFT" }), false);
});

test("requires a declared GPS for a rental offer", () => {
  const rental = { depositFcfa: "200 000", kmPerDay: "200", zone: "Grand Abidjan", gpsModel: "Teltonika FMB920", gpsSerial: "356307042441013" };
  assert.equal(rentalInput.parse(rental).depositFcfa, 200000);
  assert.equal(rentalInput.safeParse({ ...rental, gpsSerial: "" }).success, false);
  assert.equal(rentalInput.safeParse({ ...rental, gpsModel: " " }).success, false);
  assert.equal(rentalInput.safeParse({ ...rental, zone: "" }).success, false);
});

test("masks a VIN and formats a price", () => {
  assert.equal(maskVin("JTDBR32E720123456"), "JTDB•••••••••3456");
  assert.equal(formatPrice(9800000), "9 800 000 FCFA");
});

test("validates a seller identity, where only the name is required", () => {
  const out = sellerProfileInput.parse({ fullName: " Kouassi Awa Marie ", company: "", position: "", yearsExperience: "" });
  assert.deepEqual(out, { fullName: "Kouassi Awa Marie", company: null, position: null, yearsExperience: null });
  const pro = { fullName: "Koné Ibrahim", company: "Lagune Auto", position: "Vendeur", yearsExperience: "7" };
  assert.equal(sellerProfileInput.parse(pro).yearsExperience, 7);
  assert.equal(sellerProfileInput.safeParse({ ...pro, fullName: "A" }).success, false);
  assert.equal(sellerProfileInput.safeParse({ ...pro, yearsExperience: "75" }).success, false);
  assert.equal(sellerProfileInput.safeParse({ ...pro, yearsExperience: "sept" }).success, false);
});

test("builds a matricule that differs for companies and private persons", () => {
  assert.equal(matriculeOf(42, "Lagune Auto"), "MA-E-000042");
  assert.equal(matriculeOf(42, null), "MA-P-000042");
  assert.equal(matriculeOf(1234567, ""), "MA-P-1234567");
  assert.equal(parseMatricule(" ma-e-000042 "), 42);
  assert.equal(parseMatricule("MA-P-1234567"), 1234567);
  assert.equal(parseMatricule("MA-X-000042"), null);
  assert.equal(parseMatricule("42"), null);
});

test("masks phone numbers and e-mails but leaves prices, years and mileage alone", () => {
  const m = "[numéro masqué]";
  assert.equal(maskContacts("Appelez-moi au 07 08 09 10 11 ce soir"), `Appelez-moi au ${m} ce soir`);
  assert.equal(maskContacts("0708091011"), m);
  assert.equal(maskContacts("mon numéro: +225 07.08.09.10.11."), `mon numéro: ${m}.`);
  assert.equal(maskContacts("00225-0508091011"), m);
  assert.equal(maskContacts("WhatsApp +33 6 12 34 56 78"), `WhatsApp ${m}`);
  assert.equal(maskContacts("écrivez à awa.k@exemple.ci svp"), "écrivez à [e-mail masqué] svp");
  assert.equal(maskContacts("au 0708091011 ou a@b.com. Merci, b@c.ci, bye"), `au ${m} ou [e-mail masqué]. Merci, [e-mail masqué], bye`);
  for (const safe of [
    "Je propose 25 000 000 FCFA, dernier prix 9 800 000.",
    "Modèle 2020, 148 000 km, visite samedi 10 h.",
    "Rendez-vous le 05/12/2026 à 08 h 30.",
  ]) {
    assert.equal(maskContacts(safe), safe);
  }
});

test("a spare part: its own fields, sale only, no vehicle fields", () => {
  const part = { kind: "SALE", category: "PIECE", brand: "Toyota", model: "Corolla 2015 à 2019", priceFcfa: "35 000", commune: "Adjamé", description: "Phare d'origine, aucune rayure, fixations intactes.", partName: "Phare avant gauche", partCondition: "Occasion", partReference: " 81170-02b30 " };
  const out = parseListing(part).data!;
  assert.equal(out.partReference, "81170-02B30");
  assert.equal(out.priceFcfa, 35000);
  assert.equal(out.year, null);
  assert.equal(out.mileageKm, null);
  assert.equal(out.fuel, null);
  assert.equal(parseListing({ ...part, partReference: "" }).data?.partReference, null);
  assert.deepEqual(parseListing({ ...part, kind: "RENT" }).errors?.kind, ["Une pièce détachée se vend, elle ne se loue pas."]);
  assert.ok(parseListing({ ...part, partName: "" }).errors?.partName);
  assert.ok(parseListing({ ...part, partCondition: "Cassée" }).errors?.partCondition);
  assert.ok(parseListing({ ...part, priceFcfa: "500" }).errors?.priceFcfa);
  // A vehicle still needs its own fields.
  assert.ok(parseListing({ ...part, category: "VOITURE" }).errors?.year);
});

test("listing titles", () => {
  assert.equal(listingTitle({ category: "VOITURE", brand: "Toyota", model: "Corolla", year: 2020, partName: null }), "Toyota Corolla 2020");
  assert.equal(listingTitle({ category: "PIECE", brand: "Toyota", model: "Corolla", year: null, partName: "Phare avant gauche" }), "Phare avant gauche pour Toyota Corolla");
});
