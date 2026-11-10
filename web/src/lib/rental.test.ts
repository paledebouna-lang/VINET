import assert from "node:assert/strict";
import { test } from "node:test";
import { contractText, inspectionInput, overlaps, parseBooking, parseDay, rentalDays } from "./rental.ts";

const day = (s: string) => parseDay(s)!;
const now = day("2026-11-10");
const who = { renterFullName: "Koné Ibrahim", licenceNumber: "CI-123456" };

test("reads calendar days and refuses impossible ones", () => {
  assert.equal(day("2026-11-10").toISOString(), "2026-11-10T00:00:00.000Z");
  assert.equal(parseDay("2026-02-30"), null);
  assert.equal(parseDay("10/11/2026"), null);
  assert.equal(parseDay(""), null);
});

test("counts both ends of a rental and detects shared days", () => {
  assert.equal(rentalDays(day("2026-11-10"), day("2026-11-10")), 1);
  assert.equal(rentalDays(day("2026-11-10"), day("2026-11-12")), 3);
  assert.equal(rentalDays(day("2026-12-30"), day("2027-01-02")), 4);
  const [a, b] = [day("2026-11-10"), day("2026-11-12")];
  assert.equal(overlaps(a, b, day("2026-11-12"), day("2026-11-15")), true); // same-day handover
  assert.equal(overlaps(a, b, day("2026-11-13"), day("2026-11-15")), false);
  assert.equal(overlaps(a, b, day("2026-11-01"), day("2026-11-30")), true);
});

test("validates a booking request", () => {
  const ok = parseBooking({ ...who, startDate: "2026-11-10", endDate: "2026-11-12" }, now);
  assert.equal(ok.data?.days, 3);
  const bad = (patch: object) => parseBooking({ ...who, startDate: "2026-11-10", endDate: "2026-11-12", ...patch }, now).errors;
  assert.ok(bad({ startDate: "2026-11-09" })?.startDate); // yesterday
  assert.ok(bad({ endDate: "2026-11-09" })?.endDate); // before the start
  assert.ok(bad({ endDate: "2027-03-01" })?.endDate); // longer than 90 days
  assert.ok(bad({ startDate: "", endDate: "" })?.startDate);
  assert.ok(bad({ renterFullName: "K" })?.renterFullName);
  assert.ok(bad({ licenceNumber: "" })?.licenceNumber);
});

test("validates an inspection", () => {
  assert.deepEqual(inspectionInput.parse({ mileageKm: "48 250", fuelPercent: "75", notes: " " }), {
    mileageKm: 48250,
    fuelPercent: 75,
    notes: null,
  });
  assert.equal(inspectionInput.safeParse({ mileageKm: "", fuelPercent: "75", notes: "" }).success, false);
  assert.equal(inspectionInput.safeParse({ mileageKm: "100", fuelPercent: "60", notes: "" }).success, false);
});

test("writes the agreed terms into the contract", () => {
  const text = contractText({
    ownerName: "Yao Koffi Serge",
    renterName: who.renterFullName,
    licenceNumber: who.licenceNumber,
    vehicle: "Toyota Hilux 2022",
    startDate: day("2026-11-10"),
    endDate: day("2026-11-12"),
    days: 3,
    pricePerDayFcfa: 45000,
    totalFcfa: 135000,
    depositFcfa: 200000,
    kmPerDay: 200,
    zone: "Grand Abidjan",
  });
  for (const part of ["Yao Koffi Serge", "Koné Ibrahim", "CI-123456", "10 novembre 2026", "12 novembre 2026", "3 jours", "45 000 FCFA par jour", "135 000 FCFA au total", "200 000 FCFA", "200 km", "Grand Abidjan"]) {
    assert.ok(text.includes(part), part);
  }
});
