import { describe, expect, it } from "vitest";

import {
  generateRecoveryCodes,
  hashRecoveryCode,
  looksLikeRecoveryCode,
  normalizeRecoveryCode,
  RECOVERY_CODE_COUNT,
} from "@/lib/auth/recovery-codes";

describe("recovery codes", () => {
  it("generates ten unique XXXXX-XXXXX codes from the unambiguous alphabet", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT);
    for (const code of codes) {
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/);
    }
  });

  it("hashing is insensitive to case, spacing, and the dash", () => {
    const canonical = hashRecoveryCode("ABCDE-23456");
    expect(hashRecoveryCode("abcde23456")).toBe(canonical);
    expect(hashRecoveryCode(" abcde - 23456 ")).toBe(canonical);
    expect(hashRecoveryCode("ABCDE-23457")).not.toBe(canonical);
  });

  it("looksLikeRecoveryCode distinguishes recovery input from TOTP input", () => {
    expect(looksLikeRecoveryCode("ABCDE-23456")).toBe(true);
    expect(looksLikeRecoveryCode("abcde23456")).toBe(true);
    expect(looksLikeRecoveryCode("123456")).toBe(false); // a TOTP code
    expect(looksLikeRecoveryCode("")).toBe(false);
  });

  it("normalization never changes length semantics for valid codes", () => {
    for (const code of generateRecoveryCodes()) {
      expect(normalizeRecoveryCode(code)).toHaveLength(10);
    }
  });
});
