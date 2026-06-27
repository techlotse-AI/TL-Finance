import { describe, expect, it } from "vitest";

import {
  RECONCILIATION_TOLERANCE,
  ROUNDING_STEP,
  formatWhole,
  roundToNearest,
  roundToNearest5,
  serializeRounded,
  withinTolerance,
} from "@/lib/money/rounding";

describe("ROUNDING_STEP / RECONCILIATION_TOLERANCE", () => {
  it("are whole-unit 5 by default", () => {
    expect(ROUNDING_STEP).toBe(5);
    expect(RECONCILIATION_TOLERANCE).toBe(5);
  });
});

describe("roundToNearest5", () => {
  it("rounds to the nearest multiple of 5", () => {
    expect(roundToNearest5("0")).toBe(0);
    expect(roundToNearest5("1")).toBe(0);
    expect(roundToNearest5("2")).toBe(0);
    expect(roundToNearest5("2.5")).toBe(5); // half up
    expect(roundToNearest5("3")).toBe(5);
    expect(roundToNearest5("7.4")).toBe(5);
    expect(roundToNearest5("7.5")).toBe(10);
    expect(roundToNearest5("1232")).toBe(1230);
    expect(roundToNearest5("1233")).toBe(1235);
    expect(roundToNearest5("1234.99")).toBe(1235);
  });

  it("handles negative amounts symmetrically (half away from zero)", () => {
    expect(roundToNearest5("-2.5")).toBe(-5);
    expect(roundToNearest5("-7.4")).toBe(-5);
    expect(roundToNearest5("-1233")).toBe(-1235);
  });
});

describe("roundToNearest with a custom step", () => {
  it("rounds to the nearest whole unit when step is 1", () => {
    expect(roundToNearest("1234.4", 1).toFixed(4)).toBe("1234.0000");
    expect(roundToNearest("1234.5", 1).toFixed(4)).toBe("1235.0000");
  });

  it("rejects a non-positive step", () => {
    expect(() => roundToNearest("100", 0)).toThrow();
    expect(() => roundToNearest("100", -5)).toThrow();
  });
});

describe("serializeRounded", () => {
  it("returns an exact 4-dp string rounded to the step", () => {
    expect(serializeRounded("1233")).toBe("1235.0000");
    expect(serializeRounded("1232")).toBe("1230.0000");
  });
});

describe("formatWhole", () => {
  it("formats without cents, rounded to the nearest 5", () => {
    // Non-breaking spaces are used by Intl; assert on the digits we control.
    const formatted = formatWhole("1233.40", "CHF");
    expect(formatted).toContain("1");
    expect(formatted).not.toContain(".");
    expect(formatted).toContain("235");
  });
});

describe("withinTolerance", () => {
  it("treats residuals up to ±5 as rounding noise", () => {
    expect(withinTolerance("0")).toBe(true);
    expect(withinTolerance("5")).toBe(true);
    expect(withinTolerance("-5")).toBe(true);
    expect(withinTolerance("4.99")).toBe(true);
    expect(withinTolerance("5.01")).toBe(false);
    expect(withinTolerance("-6")).toBe(false);
  });

  it("accepts a custom tolerance", () => {
    expect(withinTolerance("9", 10)).toBe(true);
    expect(withinTolerance("11", 10)).toBe(false);
  });
});
