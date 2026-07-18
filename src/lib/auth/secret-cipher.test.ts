import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret, secretCipherConfigured } from "@/lib/auth/secret-cipher";

const KEY = "test-totp-encryption-key-0123456789abcdef";

describe("secret cipher (AES-256-GCM)", () => {
  beforeEach(() => {
    process.env.TOTP_ENCRYPTION_KEY = KEY;
  });
  afterEach(() => {
    delete process.env.TOTP_ENCRYPTION_KEY;
  });

  it("round-trips and never emits the same payload twice (random IV)", () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    const first = encryptSecret(secret);
    const second = encryptSecret(secret);
    expect(first).not.toBe(second);
    expect(first.startsWith("v1.")).toBe(true);
    expect(first).not.toContain(secret);
    expect(decryptSecret(first)).toBe(secret);
    expect(decryptSecret(second)).toBe(secret);
  });

  it("fails closed on a tampered ciphertext or tag", () => {
    const payload = encryptSecret("SECRET");
    const parts = payload.split(".");
    const flip = (part: string) => (part[0] === "A" ? `B${part.slice(1)}` : `A${part.slice(1)}`);
    expect(() => decryptSecret([parts[0], parts[1], parts[2], flip(parts[3])].join("."))).toThrow();
    expect(() => decryptSecret([parts[0], parts[1], flip(parts[2]), parts[3]].join("."))).toThrow();
  });

  it("fails closed on malformed or wrong-version payloads", () => {
    expect(() => decryptSecret("not-a-payload")).toThrow();
    expect(() => decryptSecret("v2.a.b.c")).toThrow();
  });

  it("fails closed when the key changes (old payloads become unreadable, not silently wrong)", () => {
    const payload = encryptSecret("SECRET");
    process.env.TOTP_ENCRYPTION_KEY = "a-completely-different-32char-key!!";
    expect(() => decryptSecret(payload)).toThrow();
  });

  it("requires a key of at least 32 characters", () => {
    delete process.env.TOTP_ENCRYPTION_KEY;
    expect(secretCipherConfigured()).toBe(false);
    expect(() => encryptSecret("x")).toThrow();
    process.env.TOTP_ENCRYPTION_KEY = "too-short";
    expect(secretCipherConfigured()).toBe(false);
    expect(() => encryptSecret("x")).toThrow();
    process.env.TOTP_ENCRYPTION_KEY = KEY;
    expect(secretCipherConfigured()).toBe(true);
  });
});
