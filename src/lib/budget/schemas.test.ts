import { describe, expect, it } from "vitest";

import { accountCreateSchema, budgetItemSchema, plannedTransferSchema } from "@/lib/budget/schemas";

const dated = {
  recurrence: "monthly" as const,
  selectedMonths: [],
  startDate: "2026-01-01",
};

describe("Budget mutation schemas", () => {
  it("requires at least one supported currency when creating an account", () => {
    const base = { name: "Daily account", type: "personal" as const };

    expect(accountCreateSchema.safeParse({ ...base, supportedCurrencies: [] }).success).toBe(false);
    expect(accountCreateSchema.parse({ ...base, supportedCurrencies: ["EUR", "CHF"] }).supportedCurrencies).toEqual(["EUR", "CHF"]);
    expect(accountCreateSchema.safeParse({ ...base, supportedCurrencies: ["AUD"] }).success).toBe(false);
    expect(accountCreateSchema.safeParse({ ...base, supportedCurrencies: ["EUR", "EUR"] }).success).toBe(false);
  });

  it("masks an account IBAN before persistence", () => {
    const account = accountCreateSchema.parse({
      name: "Daily account",
      type: "personal",
      maskedReference: "CH93 0076 2011 6238 5295 7",
      supportedCurrencies: ["CHF"],
    });

    expect(account.maskedReference).toBe("••••••••2957");
  });

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

  it("accepts yearly expense amounts and validates selected-month recurrence", () => {
    const expense = {
      name: "Annual insurance",
      categoryId: "category",
      kind: "expense" as const,
      amount: "1200.00",
      currency: "CHF",
      startDate: "2026-01-01",
    };

    expect(budgetItemSchema.safeParse({
      ...expense,
      recurrence: "yearly",
      selectedMonths: [],
    }).success).toBe(true);
    expect(budgetItemSchema.safeParse({
      ...expense,
      recurrence: "custom_months",
      selectedMonths: [],
    }).success).toBe(false);
    expect(budgetItemSchema.safeParse({
      ...expense,
      recurrence: "custom_months",
      selectedMonths: [3, 9],
    }).success).toBe(true);
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
