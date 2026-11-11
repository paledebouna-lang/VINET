import assert from "node:assert/strict";
import { test } from "node:test";
import { answeredWithinADay, formatDuration, median, percent, periodStart, viewsOutsideCases } from "./pilot.ts";

const now = new Date("2026-11-11T12:00:00Z");
const h = (hours: number) => new Date(now.getTime() - hours * 3_600_000);

test("period start: a valid past date, else 90 days ago", () => {
  assert.equal(periodStart("2026-10-01", now).toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(periodStart(undefined, now).toISOString(), "2026-08-13T12:00:00.000Z");
  assert.equal(periodStart("2027-01-01", now).toISOString(), "2026-08-13T12:00:00.000Z");
  assert.equal(periodStart("2026-13-45", now).toISOString(), "2026-08-13T12:00:00.000Z");
  assert.equal(periodStart(["2026-10-01"], now).toISOString(), "2026-08-13T12:00:00.000Z");
});

test("median and durations", () => {
  assert.equal(median([]), null);
  assert.equal(median([5, 1, 3]), 3);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(formatDuration(null), "Pas encore de donnée");
  assert.equal(formatDuration(25 * 60_000), "25 min");
  assert.equal(formatDuration(3 * 3_600_000 + 5 * 60_000), "3 h 05");
  assert.equal(formatDuration(50 * 3_600_000), "2 j 2 h");
  assert.equal(percent(1, 3), "33 %");
  assert.equal(percent(0, 0), "Pas encore de donnée");
});

test("answers within a day", () => {
  const b = "buyer", s = "seller";
  const threads = [
    { buyerId: b, createdAt: h(50), messages: [{ senderId: b, createdAt: h(50) }, { senderId: s, createdAt: h(40) }] }, // in time
    { buyerId: b, createdAt: h(50), messages: [{ senderId: b, createdAt: h(50) }, { senderId: s, createdAt: h(20) }] }, // late
    { buyerId: b, createdAt: h(30), messages: [{ senderId: b, createdAt: h(30) }] }, // never, and too old to be
    { buyerId: b, createdAt: h(2), messages: [{ senderId: b, createdAt: h(2) }] }, // still has time: left out
    { buyerId: b, createdAt: h(2), messages: [{ senderId: b, createdAt: h(2) }, { senderId: s, createdAt: h(1) }] }, // in time
  ];
  assert.deepEqual(answeredWithinADay(threads, now), { answered: 2, eligible: 4 });
});

test("position views outside a confirmed case", () => {
  const cases = [
    { avsId: "A", status: "CLOSED", decidedAt: h(48), closedAt: h(24) },
    { avsId: "B", status: "REJECTED", decidedAt: h(48), closedAt: null },
  ];
  const owners = new Map([["C", "admin"]]);
  const views = [
    { actorId: "admin", target: "A", at: h(30) }, // during the case
    { actorId: "admin", target: "A", at: h(10) }, // after it closed
    { actorId: "admin", target: "B", at: h(10) }, // the case was refused
    { actorId: "admin", target: "C", at: h(10) }, // the admin's own vehicle
  ];
  assert.equal(viewsOutsideCases(views, cases, owners), 2);
});
