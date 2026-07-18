import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Dependency-free TOTP (RFC 6238) on HOTP (RFC 4226), HMAC-SHA1, 6 digits,
 * 30-second steps — the profile every mainstream authenticator app uses.
 * Implemented on Node `crypto` per AGENTS.md's locked stack; golden-tested
 * against the published RFC 4226 Appendix D and RFC 6238 Appendix B vectors
 * (see totp.test.ts) rather than another implementation.
 *
 * Verification is fail-closed and replay-safe: the caller passes the highest
 * previously accepted time-step (`notBeforeStep`), and any code for a step at
 * or below it is rejected even when it would otherwise fall inside the ±1
 * step tolerance window.
 */

export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
/** Steps accepted either side of "now" — tolerates one step of clock drift. */
export const TOTP_WINDOW = 1;

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** RFC 4648 base32, no padding (the otpauth:// convention). */
export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

/** Strict decode: rejects any character outside the RFC 4648 alphabet. */
export function base32Decode(encoded: string): Uint8Array {
  const clean = encoded.toUpperCase().replace(/=+$/, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error("Invalid base32 character in TOTP secret.");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Uint8Array.from(output);
}

/** 160-bit random secret (the SHA-1 block-friendly size RFC 4226 recommends), base32-encoded. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** RFC 4226 HOTP: HMAC-SHA1 over the big-endian 8-byte counter, dynamic truncation. */
export function hotp(secret: Uint8Array, counter: bigint, digits: number = TOTP_DIGITS): string {
  const counterBytes = Buffer.alloc(8);
  counterBytes.writeBigUInt64BE(counter);
  const digest = createHmac("sha1", Buffer.from(secret)).update(counterBytes).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 10 ** digits).padStart(digits, "0");
}

/** The TOTP time-step for a given unix time (seconds). */
export function totpStep(unixSeconds: number, stepSeconds: number = TOTP_STEP_SECONDS): bigint {
  return BigInt(Math.floor(unixSeconds / stepSeconds));
}

/** The code for a given time — enrollment previews and tests only; verification goes through verifyTotp. */
export function totpCode(
  secretBase32: string,
  unixSeconds: number,
  digits: number = TOTP_DIGITS,
  stepSeconds: number = TOTP_STEP_SECONDS,
): string {
  return hotp(base32Decode(secretBase32), totpStep(unixSeconds, stepSeconds), digits);
}

export interface VerifyTotpOptions {
  /** Unix seconds "now"; injectable for tests. */
  now: number;
  /**
   * Highest previously accepted step. Codes for steps <= this are replays and
   * always rejected. Omit (or pass null) for first-time verification.
   */
  notBeforeStep?: bigint | null;
  window?: number;
}

/**
 * Constant-time comparison across the tolerance window. Returns the matched
 * step (to persist as the new notBeforeStep) or null when the code is wrong,
 * malformed, or a replay.
 */
export function verifyTotp(
  secretBase32: string,
  code: string,
  options: VerifyTotpOptions,
): bigint | null {
  const normalized = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalized)) return null;

  const secret = base32Decode(secretBase32);
  const currentStep = totpStep(options.now);
  const window = options.window ?? TOTP_WINDOW;
  const provided = Buffer.from(normalized);

  for (let offset = -window; offset <= window; offset++) {
    const step = currentStep + BigInt(offset);
    if (step < 0n) continue;
    if (options.notBeforeStep != null && step <= options.notBeforeStep) continue;
    const expected = Buffer.from(hotp(secret, step));
    if (expected.length === provided.length && timingSafeEqual(expected, provided)) {
      return step;
    }
  }
  return null;
}

/** The otpauth:// enrollment URI (also usable for manual entry alongside the raw secret). */
export function otpauthUri(secretBase32: string, accountEmail: string, issuer = "TL Finance"): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountEmail)}`;
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
