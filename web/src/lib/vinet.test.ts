import assert from "node:assert/strict";
import { test } from "node:test";
import { beaconCounter, beaconInput, computeEid, lastDetection, openKey, resolveEid, sealKey } from "./vinet.ts";

const key = (hex: string) => Buffer.from(hex, "hex");

test("EID matches values from an independent port of Google's eidtools.py", () => {
  const vectors: [string, number, number, string][] = [
    ["000102030405060708090a0b0c0d0e0f", 10, 0, "df8e76bbfec4efc5"],
    ["000102030405060708090a0b0c0d0e0f", 10, 1023, "df8e76bbfec4efc5"],
    ["000102030405060708090a0b0c0d0e0f", 10, 1024, "f7a6081d867e3474"],
    ["e2a0c4b15f6d7e8899aabbccddeeff00", 15, 65280, "d436819f146971b5"],
    ["e2a0c4b15f6d7e8899aabbccddeeff00", 15, 4294967295, "0f408f5589ecefcf"],
    ["ffffffffffffffffffffffffffffffff", 8, 123456789, "c8d04e725d21a51a"],
  ];
  for (const [ik, k, t, eid] of vectors) assert.equal(computeEid(key(ik), k, t), eid);
});

test("an EID resolves to its beacon around its time, not long after", () => {
  const ik = key("000102030405060708090a0b0c0d0e0f");
  const registeredAt = new Date("2026-11-11T10:00:00Z");
  const clockOffset = registeredAt.getTime() / 1000 - 5000;
  const beacons = [
    { id: "other", identityKey: key("ffffffffffffffffffffffffffffffff"), rotationExponent: 10, clockOffset: 0 },
    { id: "mine", identityKey: ik, rotationExponent: 10, clockOffset },
  ];
  const at = new Date(registeredAt.getTime() + 3 * 86_400_000);
  const eid = computeEid(ik, 10, beaconCounter(at, clockOffset));
  assert.equal(resolveEid(eid, at, beacons), "mine");
  // A beacon clock 20 minutes off is still recognised; a replay a day later is not.
  assert.equal(resolveEid(eid, new Date(at.getTime() + 20 * 60_000), beacons), "mine");
  assert.equal(resolveEid(eid, new Date(at.getTime() + 86_400_000), beacons), null);
  assert.equal(resolveEid("0000000000000000", at, beacons), null);
});

test("the identity key is sealed, and tampering is detected", () => {
  process.env.VINET_SECRET = "test-secret";
  const ik = key("e2a0c4b15f6d7e8899aabbccddeeff00");
  const sealed = sealKey(ik);
  assert.ok(!sealed.includes(ik.toString("base64url")));
  assert.deepEqual(openKey(sealed), ik);
  const [iv, tag, data] = sealed.split(".");
  assert.throws(() => openKey([iv, tag, data.slice(0, -2) + (data.endsWith("A") ? "BA" : "AA")].join(".")));
});

test("registration input", () => {
  const ok = beaconInput.safeParse({ identityKey: "00:01:02:03:04:05:06:07:08:09:0A:0B:0C:0D:0E:0F", rotationExponent: "10", counter: "65280", eid: "DF8E 76BB FEC4 EFC5" });
  assert.ok(ok.success);
  assert.equal(ok.data.identityKey, "000102030405060708090a0b0c0d0e0f");
  assert.equal(ok.data.eid, "df8e76bbfec4efc5");
  assert.ok(!beaconInput.safeParse({ identityKey: "0011", rotationExponent: "10", counter: "1", eid: "df8e76bbfec4efc5" }).success);
  assert.ok(!beaconInput.safeParse({ identityKey: "000102030405060708090a0b0c0d0e0f", rotationExponent: "4", counter: "1", eid: "df8e76bbfec4efc5" }).success);
  assert.ok(!beaconInput.safeParse({ identityKey: "000102030405060708090a0b0c0d0e0f", rotationExponent: "10", counter: "4294967296", eid: "df8e76bbfec4efc5" }).success);
});

test("last detection: radius, and confirmation by a second detector nearby", () => {
  const t = (min: number) => new Date(Date.UTC(2026, 10, 11, 12, min));
  const one = lastDetection([{ detectedAt: t(0), detectorId: "a", latitude: 5.32, longitude: -4.01, accuracyM: 10 }]);
  assert.equal(one?.radiusM, 60);
  assert.equal(one?.detectors, 1);
  assert.match(one!.quality, /un seul/);
  const two = lastDetection([
    { detectedAt: t(0), detectorId: "a", latitude: 5.32, longitude: -4.01, accuracyM: 10 },
    { detectedAt: t(5), detectorId: "b", latitude: 5.321, longitude: -4.011, accuracyM: null },
    // Far away: does not confirm.
    { detectedAt: t(4), detectorId: "c", latitude: 6.82, longitude: -5.28, accuracyM: 5 },
  ]);
  assert.equal(two?.detection.detectorId, "b");
  assert.equal(two?.detectors, 2);
  assert.equal(lastDetection([]), null);
});
