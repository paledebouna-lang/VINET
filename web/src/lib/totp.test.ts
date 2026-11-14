import assert from "node:assert/strict";
import { test } from "node:test";
import { base32, hotp, matchTotp, otpauthUri } from "./totp.ts";

// The secret of the RFC 6238 test vectors (appendix B), SHA-1.
const key = Buffer.from("12345678901234567890");

test("RFC 6238 test vectors, last 6 digits", () => {
  const vectors: [number, string][] = [
    [59, "287082"],
    [1111111109, "081804"],
    [1111111111, "050471"],
    [1234567890, "005924"],
    [2000000000, "279037"],
    [20000000000, "353130"],
  ];
  for (const [seconds, code] of vectors) assert.equal(hotp(key, Math.floor(seconds / 30)), code);
});

test("base32 as RFC 4648 and as the apps expect it", () => {
  assert.equal(base32(key), "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  assert.equal(base32(Buffer.from("f")), "MY");
  assert.ok(otpauthUri(key, "leboss@exemple.ci").startsWith("otpauth://totp/MonAuto:leboss%40exemple.ci?secret=GEZDGNBV"));
});

test("a code is accepted once, around its time only", () => {
  const now = 1111111111 * 1000;
  const step = Math.floor(1111111111 / 30);
  assert.equal(matchTotp(key, "050471", -1, now), step);
  assert.equal(matchTotp(key, "050 471", -1, now), step);
  // Already used: refused.
  assert.equal(matchTotp(key, "050471", step, now), null);
  // Phone clock 30 s off: accepted; 2 minutes off: refused.
  assert.equal(matchTotp(key, "050471", -1, now + 30_000), step);
  assert.equal(matchTotp(key, "050471", -1, now + 120_000), null);
  assert.equal(matchTotp(key, "000000", -1, now), null);
  assert.equal(matchTotp(key, "05047", -1, now), null);
  assert.equal(matchTotp(key, "abcdef", -1, now), null);
});
