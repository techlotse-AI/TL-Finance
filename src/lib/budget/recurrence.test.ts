import { describe, expect, it } from "vitest";

import { normalizeMonthly } from "@/lib/budget/recurrence";

describe("normalizeMonthly", () => {
  it.each([
    ["weekly", "100.0000", [], "433.3333", "0.0000"],
    ["monthly", "100.0000", [], "100.0000", "0.0000"],
    ["quarterly", "300.0000", [], "100.0000", "0.0000"],
    ["yearly", "1200.0000", [], "100.0000", "0.0000"],
    ["custom_months", "120.0000", [1, 4, 7, 10], "40.0000", "0.0000"],
    ["once", "500.0000", [], "0.0000", "500.0000"],
  ] as const)(
    "normalizes %s using Decimal arithmetic",
    (recurrence, amount, selectedMonths, monthlyAmount, oneTimeAmount) => {
      expect(normalizeMonthly({ amount, recurrence, selectedMonths: [...selectedMonths] })).toEqual({
        monthlyAmount,
        oneTimeAmount,
      });
    },
  );

  it("rejects invalid custom selected months", () => {
    expect(() =>
      normalizeMonthly({ amount: "100", recurrence: "custom_months", selectedMonths: [1, 1] }),
    ).toThrow("unique");
    expect(() =>
      normalizeMonthly({ amount: "100", recurrence: "custom_months", selectedMonths: [] }),
    ).toThrow("at least one");
  });

  it("rejects selected months for other recurrence types", () => {
    expect(() =>
      normalizeMonthly({ amount: "100", recurrence: "monthly", selectedMonths: [1] }),
    ).toThrow("only valid");
  });
});
