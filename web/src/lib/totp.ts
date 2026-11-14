import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Time-based one-time codes (RFC 6238, SHA-1, 6 digits, 30 seconds): what authenticator apps
 * such as Google Authenticator or Microsoft Authenticator compute.
 */

const PERIOD_S = 30;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export const newTotpSecret = () => randomBytes(20);

/** RFC 4648 base32, without padding: how a secret is typed into an app. */
export function base32(bytes: Buffer) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/** The 6-digit code for one counter value (RFC 4226). */
export function hotp(key: Buffer, counter: number) {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hash = createHmac("sha1", key).update(message).digest();
  const offset = hash[hash.length - 1] & 0xf;
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

/**
 * The time step a code belongs to, accepting one step either side for a phone clock slightly off,
 * or null. Steps up to `usedStep` are refused, so a code seen over someone's shoulder cannot be reused.
 */
export function matchTotp(key: Buffer, code: string, usedStep = -1, now = Date.now()) {
  const typed = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(typed)) return null;
  const step = Math.floor(now / 1000 / PERIOD_S);
  for (const s of [step, step - 1, step + 1]) {
    if (s > usedStep && timingSafeEqual(Buffer.from(hotp(key, s)), Buffer.from(typed))) return s;
  }
  return null;
}

/** What the QR code holds: an app scanning it adds the account by itself. */
export const otpauthUri = (secret: Buffer, account: string) =>
  `otpauth://totp/MonAuto:${encodeURIComponent(account)}?secret=${base32(secret)}&issuer=MonAuto&digits=6&period=${PERIOD_S}`;
