import assert from "node:assert/strict";
import { test } from "node:test";
import { isoDay, today } from "./rental.ts";
import { maskMiddle, mileageWarning, newAvsId, parseAvsId, parsePosition, serviceInput, sightingInput, vehicleInput } from "./vehicle.ts";

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

test("reads a maintenance log entry", () => {
  const ok = serviceInput(2018).safeParse({ date: "2019-03-02", mileageKm: "48 500", work: " Vidange et filtres ", garage: "" });
  assert.ok(ok.success);
  assert.deepEqual(ok.data, { date: new Date("2019-03-02T00:00:00Z"), mileageKm: 48500, work: "Vidange et filtres", garage: null });
  const tomorrow = isoDay(new Date(today().getTime() + 86_400_000));
  for (const date of ["2016-12-31", tomorrow, "2019-02-30", "hier"]) {
    assert.equal(serviceInput(2018).safeParse({ date, mileageKm: "1", work: "Freins", garage: "" }).success, false, date);
  }
  assert.ok(serviceInput(2018).safeParse({ date: "2017-06-01", mileageKm: "0", work: "Pneus", garage: "" }).success);
  for (const mileageKm of ["", "-5", "12,5", "3000000"]) {
    assert.equal(serviceInput(2018).safeParse({ date: "2019-03-02", mileageKm, work: "Freins", garage: "" }).success, false, mileageKm);
  }
});

test("spots kilometres going backwards", () => {
  const at = (date: string, mileageKm: number) => ({ date: new Date(`${date}T00:00:00Z`), mileageKm });
  const log = [at("2022-05-01", 60000), at("2020-01-10", 30000), at("2021-03-01", 45000)];
  assert.equal(mileageWarning(log), null);
  assert.equal(mileageWarning(log, 61000), null);
  assert.match(mileageWarning(log, 50000)!, /60 000 km/);
  assert.match(mileageWarning([...log, at("2023-01-01", 40000)])!, /moins de kilomètres/);
  // Two entries the same day are read in kilometre order.
  assert.equal(mileageWarning([at("2022-05-01", 61000), at("2022-05-01", 60000)]), null);
  assert.equal(mileageWarning([]), null);
});
