import { describe, expect, it } from "vitest";

import { reconcileIncomeAllocations } from "@/lib/budget/income-allocations";

describe("reconcileIncomeAllocations", () => {
  it("reconciles mixed fixed and percentage allocations exactly", () => {
    expect(
      reconcileIncomeAllocations("1000.0000", [
        { method: "fixed", fixedAmount: "250.0000" },
        { method: "percentage", percentage: "0.750000" },
      ]),
    ).toEqual([
      { index: 0, amount: "250.0000" },
      { index: 1, amount: "750.0000" },
    ]);
  });

  it("rejects over-allocation", () => {
    expect(() =>
      reconcileIncomeAllocations("1000.0000", [
        { method: "fixed", fixedAmount: "800.0000" },
        { method: "fixed", fixedAmount: "300.0000" },
      ]),
    ).toThrow("reconcile exactly");
  });
});
