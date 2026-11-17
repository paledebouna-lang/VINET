import assert from "node:assert/strict";
import { test } from "node:test";
import { describeFacts } from "./writing-help.ts";

test("only the facts given are sent, with the seller's notes and no contact details", () => {
  const text = describeFacts({
    kind: "SALE", category: "VOITURE", brand: "Toyota", model: "Corolla", year: "2020", mileageKm: "48 000",
    fuel: "Essence", transmission: "", commune: "Cocody", description: "Première main. Appelez le 07 08 09 10 11.",
  });
  assert.match(text, /Annonce : vente d'un véhicule/);
  assert.match(text, /Kilométrage : 48 000 km/);
  assert.match(text, /Commune : Cocody, Abidjan/);
  assert.ok(!text.includes("Boîte de vitesses"), "an empty field is left out");
  assert.ok(text.includes("[numéro masqué]") && !text.includes("07 08 09"));
});

test("a rental and a spare part are described as such", () => {
  const rent = describeFacts({ kind: "RENT", category: "UTILITAIRE", brand: "Toyota", model: "Hiace", kmPerDay: "200", zone: "Grand Abidjan" });
  assert.match(rent, /location d'un véhicule/);
  assert.match(rent, /Kilomètres inclus par jour : 200/);
  assert.match(rent, /Notes du vendeur : aucune/);
  const part = describeFacts({ kind: "SALE", category: "PIECE", brand: "Toyota", model: "Corolla 2015 à 2019", partName: "Phare avant gauche", partCondition: "Occasion", year: "2020" });
  assert.match(part, /pièce détachée/);
  assert.match(part, /Compatible avec : Toyota Corolla 2015 à 2019/);
  assert.ok(!part.includes("Année"), "vehicle fields are not sent for a part");
});
