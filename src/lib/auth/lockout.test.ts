import { describe, expect, it } from "vitest";

import {
  DEFAULT_LOCKOUT_POLICY,
  isLocked,
  lockoutPolicyFromEnv,
  lockRemainingSeconds,
  registerFailedAttempt,
} from "@/lib/auth/lockout";

const NOW = new Date("2026-06-17T12:00:00.000Z");

describe("registerFailedAttempt", () => {
  it("increments without locking below the threshold", () => {
    const result = registerFailedAttempt(3, NOW);
    expect(result.failedLoginCount).toBe(4);
    expect(result.lockedUntil).toBeNull();
    expect(result.newlyLocked).toBe(false);
  });

  it("locks for the first backoff when the threshold is reached", () => {
    const result = registerFailedAttempt(4, NOW); // 5th failure, threshold 5
    expect(result.failedLoginCount).toBe(5);
    expect(result.newlyLocked).toBe(true);
    expect(result.lockedUntil?.toISOString()).toBe("2026-06-17T12:15:00.000Z");
  });

  it("escalates the backoff and caps at the final value", () => {
    expect(registerFailedAttempt(5, NOW).lockedUntil?.toISOString()).toBe("2026-06-17T12:30:00.000Z");
    expect(registerFailedAttempt(6, NOW).lockedUntil?.toISOString()).toBe("2026-06-17T13:00:00.000Z");
    expect(registerFailedAttempt(7, NOW).lockedUntil?.toISOString()).toBe("2026-06-17T14:00:00.000Z");
    // Beyond the schedule length, the last (120 min) backoff caps escalation.
    expect(registerFailedAttempt(20, NOW).lockedUntil?.toISOString()).toBe("2026-06-17T14:00:00.000Z");
  });

  it("treats negative or fractional counts as a first failure", () => {
    expect(registerFailedAttempt(-3, NOW).failedLoginCount).toBe(1);
    expect(registerFailedAttempt(2.9, NOW).failedLoginCount).toBe(3);
  });
});

describe("isLocked / lockRemainingSeconds", () => {
  it("reports an active lock and its remaining time", () => {
    const lockedUntil = new Date(NOW.getTime() + 90_000);
    expect(isLocked({ lockedUntil }, NOW)).toBe(true);
    expect(lockRemainingSeconds(lockedUntil, NOW)).toBe(90);
  });

  it("reports an expired or absent lock as unlocked", () => {
    const past = new Date(NOW.getTime() - 1000);
    expect(isLocked({ lockedUntil: past }, NOW)).toBe(false);
    expect(isLocked({ lockedUntil: null }, NOW)).toBe(false);
    expect(lockRemainingSeconds(null, NOW)).toBe(0);
  });
});

describe("lockoutPolicyFromEnv", () => {
  it("falls back to defaults with no configuration", () => {
    expect(lockoutPolicyFromEnv({})).toEqual(DEFAULT_LOCKOUT_POLICY);
  });

  it("parses overrides and ignores invalid entries", () => {
    const policy = lockoutPolicyFromEnv({
      LOGIN_LOCKOUT_THRESHOLD: "3",
      LOGIN_LOCKOUT_BACKOFF_MINUTES: "5, 10, x, -2, 20",
    });
    expect(policy.threshold).toBe(3);
    expect(policy.backoffMinutes).toEqual([5, 10, 20]);
  });

  it("ignores a non-positive threshold", () => {
    expect(lockoutPolicyFromEnv({ LOGIN_LOCKOUT_THRESHOLD: "0" }).threshold).toBe(
      DEFAULT_LOCKOUT_POLICY.threshold,
    );
  });
});
