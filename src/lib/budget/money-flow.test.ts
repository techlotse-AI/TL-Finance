import { describe, expect, it } from "vitest";

import { demoPlan } from "@/lib/budget/demo-plan";
import { buildMoneyFlow } from "@/lib/budget/money-flow";

describe("buildMoneyFlow", () => {
  it("keeps internal transfers out of spending and reconciles source rows", () => {
    expect(demoPlan.totals).toEqual({
      income: "7800.0000",
      expenses: "5400.0000",
      contributions: "588.0000",
      transfers: "2400.0000",
      unallocated: "1812.0000",
      oneTimeIncome: "0.0000",
      oneTimeUses: "0.0000",
    });
    expect(demoPlan.links.find((link) => link.id === "transfer:fund-bills")).toMatchObject({
      internalTransfer: true,
      amount: "2400.0000",
    });
    expect(demoPlan.warnings).toEqual([
      expect.objectContaining({
        code: "unallocated_pocket_funds",
        resourceId: "daily-chf",
        amount: "1812.0000",
      }),
    ]);
  });

  it("converts only at the explicit reporting boundary", () => {
    const result = buildMoneyFlow({
      reportingCurrency: "CHF",
      exchangeRates: [{ currency: "EUR", rateToReportingCurrency: "0.950000" }],
      pockets: [{ id: "eur", name: "EUR pocket", currency: "EUR" }],
      incomeSources: [
        {
          id: "income",
          name: "Income",
          currency: "EUR",
          monthlyAmount: "100.0000",
          allocations: [{ pocketId: "eur", amount: "100.0000" }],
        },
      ],
      transfers: [],
      budgetItems: [],
    });

    expect(result.totals.income).toBe("95.0000");
    expect(result.links[0]).toMatchObject({
      nativeAmount: "100.0000",
      nativeCurrency: "EUR",
      amount: "95.0000",
    });
  });

  it("fails closed without an exchange rate", () => {
    expect(() =>
      buildMoneyFlow({
        reportingCurrency: "CHF",
        pockets: [],
        incomeSources: [
          {
            id: "income",
            name: "Income",
            currency: "EUR",
            monthlyAmount: "100.0000",
            allocations: [],
          },
        ],
        transfers: [],
        budgetItems: [],
      }),
    ).toThrow("Missing EUR");
  });
});
