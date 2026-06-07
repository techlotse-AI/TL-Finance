import { describe, expect, it } from "vitest";

import { reconcileActualAllocations } from "@/lib/analysis/allocation";

describe("actual allocation reconciliation", () => {
  it("reconciles signed splits", () => {
    expect(reconcileActualAllocations("-100.0000", [
      { amount: "-60", categoryId: "a" }, { amount: "-40", categoryId: "b" },
    ])).toEqual({ allocatedAmount: "-100.0000", remainingAmount: "0.0000", reconciled: true });
  });
  it("keeps explicit partial allocations visible", () => {
    expect(reconcileActualAllocations("-100", [{ amount: "-25", categoryId: "a" }], true).remainingAmount).toBe("-75.0000");
  });
});
