import { describe, expect, it } from "vitest";

import { hasCapability } from "@/lib/entitlements/capabilities";

describe("hasCapability", () => {
  it("provides Budget capabilities to every product tier", () => {
    expect(hasCapability("budget", "budget.write")).toBe(true);
    expect(hasCapability("analyze", "budget.write")).toBe(true);
    expect(hasCapability("optimize", "budget.write")).toBe(true);
  });

  it("keeps later-tier and instance-admin capabilities server gated", () => {
    expect(hasCapability("budget", "analysis.read")).toBe(false);
    expect(hasCapability("analyze", "optimize.run")).toBe(false);
    expect(hasCapability("optimize", "optimize.run")).toBe(true);
    expect(hasCapability("optimize", "admin.tiers.manage")).toBe(false);
    expect(hasCapability("budget", "admin.tiers.manage", true)).toBe(true);
  });
});
