import { describe, expect, it } from "vitest";

import { budgetItemSchema, plannedTransferSchema } from "@/lib/budget/schemas";

const dated = {
  recurrence: "monthly" as const,
  selectedMonths: [],
  startDate: "2026-01-01",
};

describe("Budget mutation schemas", () => {
  it("allows an expense without a funding pocket", () => {
    expect(
      budgetItemSchema.parse({
        ...dated,
        name: "Unallocated expense",
        categoryId: "category",
        kind: "expense",
        amount: "100.00",
        currency: "chf",
      }).currency,
    ).toBe("CHF");
  });

  it.each(["saving", "investment", "retirement"] as const)(
    "requires distinct source and destination pockets for %s",
    (kind) => {
      const result = budgetItemSchema.safeParse({
        ...dated,
        name: "Contribution",
        categoryId: "category",
        kind,
        amount: "100.00",
        currency: "CHF",
        paidFromAccountPocketId: "same",
        paidToAccountPocketId: "same",
      });

      expect(result.success).toBe(false);
    },
  );

  it("rejects a transfer to the same pocket", () => {
    const result = plannedTransferSchema.safeParse({
      ...dated,
      name: "Invalid transfer",
      fromAccountPocketId: "same",
      toAccountPocketId: "same",
      amount: "100.00",
      currency: "CHF",
    });

    expect(result.success).toBe(false);
  });
});
