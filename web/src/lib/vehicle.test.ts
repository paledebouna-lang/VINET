import assert from "node:assert/strict";
import { test } from "node:test";
import { maskMiddle, newAvsId, parseAvsId, parsePosition, sightingInput, vehicleInput } from "./vehicle.ts";

test("issues unguessable identifiers that read back", () => {
  const ids = new Set(Array.from({ length: 200 }, newAvsId));
  assert.equal(ids.size, 200);
  for (const id of ids) {
    assert.match(id, /^AVS-CI-\w{4}-\w{4}-\w{4}$/);
    assert.doesNotMatch(id.slice("AVS-CI-".length), /[01OIL]/, id); // the random part only
    assert.equal(parseAvsId(` ${id.toLowerCase()} `), id);
  }
});

test("rejects what cannot be an identifier", () => {
  for (const bad of ["", "AVS-CI-7K2Q-91XM", "AVS-CI-7K2Q-91XM-B4T0", "AVS-FR-7K2Q-9BXM-B4TD", "../admin", "AVS-CI-7K2Q-9BXM-B4TD/x"]) {
    assert.equal(parseAvsId(bad), null, bad);
  }
});

const car = { category: "VOITURE", brand: "Toyota", model: "Corolla", year: "2020", color: "Grise", serial: "jtdbr32e7-2012 3456", plate: " 1234  ab 01 " };

test("validates and normalises a vehicle", () => {
  const out = vehicleInput.parse(car);
  assert.equal(out.serial, "JTDBR32E720123456");
  assert.equal(out.plate, "1234 AB 01");
  assert.equal(vehicleInput.parse({ ...car, plate: "" }).plate, null);
  const bad = (patch: object) => vehicleInput.safeParse({ ...car, ...patch }).success;
  assert.equal(bad({ serial: "AB1" }), false);
  assert.equal(bad({ serial: "JTDBR32E7<script>" }), false);
  assert.equal(bad({ year: "1900" }), false);
  assert.equal(bad({ color: "" }), false);
  assert.equal(bad({ plate: "<b>" }), false);
});

test("masks the middle of a serial number or plate", () => {
  assert.equal(maskMiddle("JTDBR32E720123456", 4), "JTDB•••••••••3456");
  assert.equal(maskMiddle("1234 AB 01"), "12••••••01");
  assert.equal(maskMiddle("AB12"), "••••");
});

test("keeps a position only when it was shared and is plausible", () => {
  const here = { sharePosition: "on", latitude: "5.3599517", longitude: "-4.0082563", accuracyM: "25" };
  assert.deepEqual(parsePosition(here), { latitude: 5.3599517, longitude: -4.0082563, accuracyM: 25 });
  assert.equal(parsePosition({ ...here, sharePosition: undefined }), null); // not shared
  assert.equal(parsePosition({ ...here, latitude: "95" }), null);
  assert.equal(parsePosition({ ...here, longitude: "abc" }), null);
  assert.equal(parsePosition({ sharePosition: "on" }), null);
});

test("validates a sighting", () => {
  assert.equal(sightingInput.safeParse({ kind: "OBSERVATION", note: "Vu garé devant la pharmacie." }).success, true);
  assert.equal(sightingInput.safeParse({ kind: "THEFT", note: "Vu garé devant la pharmacie." }).success, false);
  assert.equal(sightingInput.safeParse({ kind: "SUSPECT", note: "court" }).success, false);
});
