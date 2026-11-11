import assert from "node:assert/strict";
import { test } from "node:test";
import { UNDERTAKINGS, caseReference, caseWindowStart, parseTheft, researchRows } from "./security.ts";

const now = new Date("2026-11-10T22:00:00Z");
const ticked = Object.fromEntries(UNDERTAKINGS.map((_, i) => [`u${i}`, "on"]));
const declaration = {
  stolenAt: "2026-11-10T19:30",
  place: "Parking de la Riviera 2, Cocody",
  circumstances: "Véhicule garé à 19 h, absent à mon retour à 21 h.",
  policeReference: "",
  ...ticked,
};

test("formats a case reference", () => {
  assert.equal(caseReference(12), "VOL-000012");
  assert.equal(caseReference(1234567), "VOL-1234567");
});

test("accepts a complete declaration and reads its time as UTC", () => {
  const { data } = parseTheft(declaration, now);
  assert.equal(data?.stolenAt.toISOString(), "2026-11-10T19:30:00.000Z");
  assert.equal(data?.policeReference, null);
  assert.equal(parseTheft({ ...declaration, policeReference: " PV 2026/1182 " }, now).data?.policeReference, "PV 2026/1182");
});

test("refuses an incomplete or implausible declaration", () => {
  const errors = (patch: object) => parseTheft({ ...declaration, ...patch }, now).errors ?? {};
  assert.ok(errors({ stolenAt: "2026-11-10T23:00" }).stolenAt); // one hour ahead
  assert.ok(errors({ stolenAt: "2006-11-10T23:00" }).stolenAt); // twenty years ago
  assert.ok(errors({ stolenAt: "hier soir" }).stolenAt);
  assert.ok(errors({ stolenAt: "" }).stolenAt);
  assert.ok(errors({ place: "" }).place);
  assert.ok(errors({ circumstances: "Volé." }).circumstances);
  // Each undertaking counts: three out of four is not enough.
  for (let i = 0; i < UNDERTAKINGS.length; i++) assert.ok(errors({ [`u${i}`]: undefined }).undertakings, `u${i}`);
  assert.equal(parseTheft({ ...declaration, u3: "off" }, now).data, undefined);
});

test("opens the position window one day before the theft", () => {
  assert.equal(caseWindowStart(new Date("2026-11-10T19:30:00Z")).toISOString(), "2026-11-09T19:30:00.000Z");
});

test("lists what is known newest first, each source with its own reliability", () => {
  const fix = { recordedAt: new Date("2026-11-10T21:00:00Z"), latitude: 5.3237, longitude: -4.0167, accuracyM: 8 };
  const seen = (at: string, patch: object = {}) => ({
    createdAt: new Date(at),
    kind: "OBSERVATION" as const,
    note: "Vu devant la pharmacie.",
    latitude: 5.36,
    longitude: -4.008,
    accuracyM: 25,
    ...patch,
  });
  const rows = researchRows(fix, false, [
    seen("2026-11-10T20:00:00Z"),
    seen("2026-11-10T21:30:00Z", { kind: "SUSPECT", latitude: null, longitude: null, accuracyM: null }),
  ]);
  assert.deepEqual(rows.map((r) => r.source), ["Soupçon · QR", "GPS · dernière position", "Observation · QR"]);
  assert.equal(rows[0].point, undefined); // nothing to draw without a position
  assert.match(rows[0].reliability, /^Faible/);
  assert.match(rows[1].reliability, /^Moyenne/); // a last known position is not a live one
  assert.equal(rows[1].point?.kind, "last");
  assert.match(rows[2].reliability, /position du téléphone du déclarant/);
  assert.match(rows[2].detail, /5\.36000, -4\.00800, à 25 m près/);

  const live = researchRows(fix, true, []);
  assert.equal(live[0].source, "GPS · en direct");
  assert.equal(live[0].reliability, "Élevée");
  assert.equal(live[0].point?.kind, "live");
  assert.deepEqual(researchRows(undefined, false, []), []);
});

test("a VINET detection is its own source, with its radius and quality", () => {
  const rows = researchRows(undefined, false, [], {
    detectedAt: new Date("2026-11-11T12:00:00Z"),
    latitude: 5.32,
    longitude: -4.01,
    radiusM: 60,
    quality: "Moyenne : un seul détecteur",
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].source, "VINET · détection");
  assert.equal(rows[0].point?.kind, "detection");
  assert.equal(rows[0].point?.radiusM, 60);
  assert.match(rows[0].detail, /60 m/);
});
