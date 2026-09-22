import { describe, expect, it } from "vitest";

import { serializeRealValue, toRealValue } from "@/lib/optimize/real-terms";

describe("toRealValue / serializeRealValue", () => {
  it("deflates a nominal future amount by compounded inflation", () => {
    // 100000 / 1.02^10, hand-verified: 82034.8300...
    expect(serializeRealValue("100000", 10, "0.02")).toBe("82034.8300");
  });

  it("matches a second worked example at a different rate and horizon", () => {
    // 50000 / 1.03^25, hand-verified: 23880.2785...
    expect(serializeRealValue("50000", 25, "0.03")).toBe("23880.2785");
  });

  it("is a no-op at zero inflation", () => {
    expect(serializeRealValue("100000", 10, "0")).toBe("100000.0000");
  });

  it("is a no-op at zero or negative years (nothing to deflate yet)", () => {
    expect(serializeRealValue("100000", 0, "0.02")).toBe("100000.0000");
    expect(serializeRealValue("100000", -1, "0.02")).toBe("100000.0000");
  });

  it("returns a Decimal from toRealValue for callers that keep computing", () => {
    const real = toRealValue("100000", 10, "0.02");
    expect(real.toDecimalPlaces(4).toFixed(4)).toBe("82034.8300");
  });
});
