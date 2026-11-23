import assert from "node:assert/strict";
import { test } from "node:test";
import { billText, contractText, inspectionInput, overlaps, parseBooking, parseDay, ratesErrors, rentalDays, rentalPrice } from "./rental.ts";

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
    pricePerWeekFcfa: 250000,
    pricePerMonthFcfa: null,
    totalFcfa: 135000,
    depositFcfa: 200000,
    kmPerDay: 200,
    zone: "Grand Abidjan",
  });
  for (const part of ["Yao Koffi Serge", "Koné Ibrahim", "CI-123456", "10 novembre 2026", "12 novembre 2026", "3 jours", "45 000 FCFA par jour", "135 000 FCFA au total", "200 000 FCFA", "200 km", "Grand Abidjan"]) {
    assert.ok(text.includes(part), part);
  }
});

test("bills the cheapest mix of days, weeks and months", () => {
  const rates = { day: 30000, week: 150000, month: 500000 };
  assert.deepEqual(rentalPrice(3, rates), { total: 90000, months: 0, weeks: 0, days: 3 });
  // Five days cost as much as a week: days are kept. Six cost more: billed as one week.
  assert.equal(rentalPrice(5, rates).weeks, 0);
  assert.deepEqual(rentalPrice(6, rates), { total: 150000, months: 0, weeks: 1, days: 0 });
  assert.deepEqual(rentalPrice(9, rates), { total: 210000, months: 0, weeks: 1, days: 2 });
  assert.deepEqual(rentalPrice(25, rates), { total: 500000, months: 1, weeks: 0, days: 0 });
  assert.deepEqual(rentalPrice(39, rates), { total: 710000, months: 1, weeks: 1, days: 2 });
  assert.deepEqual(rentalPrice(90, rates), { total: 1500000, months: 3, weeks: 0, days: 0 });
  // Without week or month rates, every day at the daily rate.
  assert.equal(rentalPrice(40, { day: 25000, week: null, month: null }).total, 1000000);
  assert.equal(billText(rentalPrice(39, rates), rates), "1 mois à 500 000 FCFA, 1 semaine à 150 000 FCFA et 2 jours à 30 000 FCFA");
  assert.equal(billText(rentalPrice(14, rates), rates), "2 semaines à 150 000 FCFA");
});

test("refuses week and month rates that would never apply", () => {
  assert.deepEqual(ratesErrors({ day: 25000, week: 150000, month: 500000 }), {});
  assert.deepEqual(ratesErrors({ day: 25000, week: null, month: null }), {});
  assert.ok(ratesErrors({ day: 25000, week: 175000, month: null }).pricePerWeekFcfa);
  assert.ok(ratesErrors({ day: 25000, week: null, month: 750000 }).pricePerMonthFcfa);
  assert.ok(ratesErrors({ day: 25000, week: 100000, month: 500000 }).pricePerMonthFcfa);
});

test("names the rates applied in the contract", () => {
  const facts = {
    ownerName: "A", renterName: "B", licenceNumber: "C", vehicle: "D", zone: "E", kmPerDay: 200, depositFcfa: 0,
    startDate: day("2026-11-10"), endDate: day("2026-11-18"), days: 9,
    pricePerDayFcfa: 25000, pricePerWeekFcfa: 150000, pricePerMonthFcfa: null, totalFcfa: 200000,
  };
  assert.ok(contractText(facts).includes("3. Prix. Tarif appliqué : 1 semaine à 150 000 FCFA et 2 jours à 25 000 FCFA, soit 200 000 FCFA au total"));
});
