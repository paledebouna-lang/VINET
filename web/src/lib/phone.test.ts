import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeCiPhone } from "./phone.ts";

test("accepts Ivorian mobile numbers in common spellings", () => {
  assert.equal(normalizeCiPhone("0708091011"), "+2250708091011");
  assert.equal(normalizeCiPhone("07 08 09 10 11"), "+2250708091011");
  assert.equal(normalizeCiPhone("+225 05 08 09 10 11"), "+2250508091011");
  assert.equal(normalizeCiPhone("00225-01-08-09-10-11"), "+2250108091011");
});

test("rejects everything else", () => {
  assert.equal(normalizeCiPhone(""), null);
  assert.equal(normalizeCiPhone("07080910"), null); // pre-2021 8-digit form
  assert.equal(normalizeCiPhone("2708091011"), null); // landline
  assert.equal(normalizeCiPhone("+33612345678"), null);
  assert.equal(normalizeCiPhone("07080910112"), null);
  assert.equal(normalizeCiPhone("07o8091011"), null);
});
