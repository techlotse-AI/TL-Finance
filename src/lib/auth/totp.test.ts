import { describe, expect, it } from "vitest";

import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  hotp,
  otpauthUri,
  totpCode,
  totpStep,
  verifyTotp,
} from "@/lib/auth/totp";

// The RFC test secret: ASCII "12345678901234567890" (RFC 4226 Appendix D /
// RFC 6238 Appendix B, SHA-1 column).
const RFC_SECRET_BYTES = new TextEncoder().encode("12345678901234567890");
const RFC_SECRET_BASE32 = base32Encode(RFC_SECRET_BYTES); // GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ

describe("base32 (RFC 4648)", () => {
  it("encodes the RFC secret to the well-known base32 form", () => {
    expect(RFC_SECRET_BASE32).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  });

  it("round-trips arbitrary lengths", () => {
    for (const length of [1, 2, 3, 4, 5, 19, 20, 33]) {
      const bytes = Uint8Array.from({ length }, (_, index) => (index * 37) % 256);
      expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
    }
  });

  it("rejects characters outside the alphabet", () => {
    expect(() => base32Decode("ABC1!")).toThrow();
  });
});

describe("hotp — RFC 4226 Appendix D vectors (6 digits, counters 0-9)", () => {
  const expected = [
    "755224", "287082", "359152", "969429", "338314",
    "254676", "287922", "162583", "399871", "520489",
  ];
  it("matches every published vector", () => {
    expected.forEach((code, counter) => {
      expect(hotp(RFC_SECRET_BYTES, BigInt(counter))).toBe(code);
    });
  });
});

describe("totp — RFC 6238 Appendix B vectors (SHA-1, 8 digits)", () => {
  const vectors: Array<[number, string]> = [
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ];
  it("matches every published vector", () => {
    for (const [time, code] of vectors) {
      expect(totpCode(RFC_SECRET_BASE32, time, 8)).toBe(code);
    }
  });
});

describe("verifyTotp", () => {
  const now = 1111111109; // step 37037036

  it("accepts the current step's code and returns the matched step", () => {
    const code = totpCode(RFC_SECRET_BASE32, now);
    expect(verifyTotp(RFC_SECRET_BASE32, code, { now })).toBe(totpStep(now));
  });

  it("accepts codes one step either side (clock drift) but not two", () => {
    const previous = totpCode(RFC_SECRET_BASE32, now - 30);
    const next = totpCode(RFC_SECRET_BASE32, now + 30);
    const tooOld = totpCode(RFC_SECRET_BASE32, now - 60);
    expect(verifyTotp(RFC_SECRET_BASE32, previous, { now })).toBe(totpStep(now - 30));
    expect(verifyTotp(RFC_SECRET_BASE32, next, { now })).toBe(totpStep(now + 30));
    expect(verifyTotp(RFC_SECRET_BASE32, tooOld, { now })).toBeNull();
  });

  it("rejects a replay: a code at or below notBeforeStep never verifies", () => {
    const code = totpCode(RFC_SECRET_BASE32, now);
    const matched = verifyTotp(RFC_SECRET_BASE32, code, { now });
    expect(matched).not.toBeNull();
    // Same code again, with the accepted step persisted — must fail.
    expect(verifyTotp(RFC_SECRET_BASE32, code, { now, notBeforeStep: matched })).toBeNull();
    // The next step's code still works.
    const nextCode = totpCode(RFC_SECRET_BASE32, now + 30);
    expect(verifyTotp(RFC_SECRET_BASE32, nextCode, { now: now + 30, notBeforeStep: matched })).toBe(
      totpStep(now + 30),
    );
  });

  it("fails closed on malformed input", () => {
    expect(verifyTotp(RFC_SECRET_BASE32, "12345", { now })).toBeNull();
    expect(verifyTotp(RFC_SECRET_BASE32, "1234567", { now })).toBeNull();
    expect(verifyTotp(RFC_SECRET_BASE32, "abcdef", { now })).toBeNull();
    expect(verifyTotp(RFC_SECRET_BASE32, "", { now })).toBeNull();
  });

  it("tolerates whitespace in user input (\"123 456\")", () => {
    const code = totpCode(RFC_SECRET_BASE32, now);
    const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
    expect(verifyTotp(RFC_SECRET_BASE32, spaced, { now })).toBe(totpStep(now));
  });
});

describe("generateTotpSecret / otpauthUri", () => {
  it("generates a 160-bit secret (32 base32 chars) that decodes cleanly", () => {
    const secret = generateTotpSecret();
    expect(secret).toHaveLength(32);
    expect(base32Decode(secret)).toHaveLength(20);
    expect(generateTotpSecret()).not.toBe(secret);
  });

  it("builds a standard otpauth URI with issuer, algorithm, digits, and period", () => {
    const uri = otpauthUri("GEZDGNBV", "user@example.com");
    expect(uri).toBe(
      "otpauth://totp/TL%20Finance:user%40example.com?secret=GEZDGNBV&issuer=TL+Finance&algorithm=SHA1&digits=6&period=30",
    );
  });
});
