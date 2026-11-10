import assert from "node:assert/strict";
import { test } from "node:test";
import { ago, distanceKm, insideZone, isLive, newAlerts, plausible, positionsPayload, zoneInput } from "./tracking.ts";

const plateau = { latitude: 5.3237, longitude: -4.0167 };
const cocody = { latitude: 5.3599, longitude: -4.0083 };
const yamoussoukro = { latitude: 6.8276, longitude: -5.2893 };
const zone = { zoneLat: plateau.latitude, zoneLng: plateau.longitude, zoneRadiusKm: 30 };
const at = (p: typeof plateau, powerCut = false) => ({ ...p, powerCut });

test("measures distances and zone membership", () => {
  assert.ok(Math.abs(distanceKm(plateau, cocody) - 4.1) < 0.3);
  assert.ok(Math.abs(distanceKm(plateau, yamoussoukro) - 218) < 5);
  assert.equal(distanceKm(plateau, plateau), 0);
  assert.equal(insideZone(cocody, zone), true);
  assert.equal(insideZone(yamoussoukro, zone), false);
});

test("raises an alert only when something changes", () => {
  const unknown = { inside: null, powerCut: false };
  // Leaving once, then staying out: one alert, not one per position.
  const out = newAlerts([at(cocody), at(yamoussoukro), at(yamoussoukro)], zone, unknown);
  assert.deepEqual(out.map((a) => a.kind), ["ZONE_EXIT"]);
  // Already outside when this batch starts: nothing new.
  assert.equal(newAlerts([at(yamoussoukro)], zone, { inside: false, powerCut: false }).length, 0);
  // Was inside at the last stored position, first new position is outside.
  assert.equal(newAlerts([at(yamoussoukro)], zone, { inside: true, powerCut: false }).length, 1);
  // Back in, out again: two exits.
  assert.equal(newAlerts([at(yamoussoukro), at(cocody), at(yamoussoukro)], zone, { inside: true, powerCut: false }).length, 2);
  // No zone, no zone alert; a power cut is reported once.
  const cut = newAlerts([at(yamoussoukro, true), at(yamoussoukro, true)], null, unknown);
  assert.deepEqual(cut.map((a) => a.kind), ["POWER_CUT"]);
  // A first position outside the zone, with nothing known before, is not an exit.
  assert.equal(newAlerts([at(yamoussoukro)], zone, unknown).length, 0);
});

test("tells a live tracker from a last known position", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  assert.equal(isLive(new Date("2026-11-10T11:59:00Z"), now), true);
  assert.equal(isLive(new Date("2026-11-10T11:50:00Z"), now), false);
  assert.equal(isLive(null, now), false);
  assert.equal(ago(new Date("2026-11-10T11:59:48Z"), now), "il y a 12 s");
  assert.equal(ago(new Date("2026-11-10T11:55:00Z"), now), "il y a 5 min");
  assert.equal(ago(new Date("2026-11-10T09:00:00Z"), now), "il y a 3 h");
  assert.equal(ago(new Date("2026-11-08T12:00:00Z"), now), "il y a 2 j");
});

test("validates what a tracker sends", () => {
  const good = { positions: [{ time: "2026-11-10T12:00:00Z", lat: 5.32, lng: -4.01, accuracy: 8, speed: 42 }] };
  assert.equal(positionsPayload.parse(good).positions[0].time.toISOString(), "2026-11-10T12:00:00.000Z");
  const bad = (positions: unknown) => positionsPayload.safeParse({ positions }).success;
  assert.equal(bad([]), false);
  assert.equal(bad([{ time: "hier", lat: 5, lng: -4 }]), false);
  assert.equal(bad([{ time: "2026-11-10T12:00:00Z", lat: 95, lng: -4 }]), false);
  assert.equal(bad([{ time: "2026-11-10T12:00:00Z", lat: "5", lng: -4 }]), false);
  assert.equal(bad(Array.from({ length: 501 }, () => good.positions[0])), false);
});

test("drops positions dated in the future or beyond the retention, and sorts the rest", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  const t = (iso: string) => ({ time: new Date(iso) });
  const kept = plausible([t("2026-11-10T11:00:00Z"), t("2026-11-10T13:00:00Z"), t("2026-01-01T00:00:00Z"), t("2026-11-10T10:00:00Z"), t("2026-11-10T12:03:00Z")], now);
  assert.deepEqual(kept.map((p) => p.time.toISOString().slice(11, 16)), ["10:00", "11:00", "12:03"]);
});

test("validates a zone", () => {
  assert.equal(zoneInput.parse({ zoneLat: "5.32", zoneLng: "-4.01", zoneRadiusKm: "30" }).zoneRadiusKm, 30);
  assert.equal(zoneInput.safeParse({ zoneLat: "5.32", zoneLng: "-4.01", zoneRadiusKm: "0" }).success, false);
  assert.equal(zoneInput.safeParse({ zoneLat: "abc", zoneLng: "-4.01", zoneRadiusKm: "30" }).success, false);
  assert.equal(zoneInput.safeParse({ zoneLat: "", zoneLng: "", zoneRadiusKm: "30" }).success, false); // empty is not 0
  assert.equal(zoneInput.parse({ zoneLat: "5,32", zoneLng: "-4,01", zoneRadiusKm: "2,5" }).zoneRadiusKm, 2.5);
});
