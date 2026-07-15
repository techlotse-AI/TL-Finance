import { describe, expect, it } from "vitest";

import { demoPlan } from "@/lib/budget/demo-plan";
import { buildMoneyFlow } from "@/lib/budget/money-flow";

describe("buildMoneyFlow", () => {
  it("keeps internal transfers out of spending and reconciles source rows", () => {
    expect(demoPlan.totals).toEqual({
      income: "7800.0000",
      // 5400 recurring + 120 provision (annual insurance saved monthly).
      expenses: "5520.0000",
      expenseProvisions: "120.0000",
      contributions: "588.0000",
      savings: "0.0000",
      investments: "0.0000",
      retirement: "588.0000",
      transfers: "2400.0000",
      unallocated: "1692.0000",
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
        amount: "1692.0000",
      }),
    ]);
  });

  it("threads the provision flag onto item nodes and their links", () => {
    const provisionLinks = demoPlan.links.filter((link) => link.provision);
    expect(provisionLinks.map((link) => link.id).sort()).toEqual([
      "category-item:insurance-annual",
      "item-category:insurance-annual",
    ]);
    expect(demoPlan.nodes.find((node) => node.id === "item:insurance-annual")).toMatchObject({
      provision: true,
    });
    // Ordinary monthly items stay undashed.
    expect(demoPlan.links.find((link) => link.id === "item-category:rent")?.provision).toBeFalsy();
  });

  it("reports per-account in/out totals and the in-equals-out flag", () => {
    const byPocket = new Map(demoPlan.accountTotals.map((entry) => [entry.pocketId, entry]));

    // Daily: 7800 in; 2400 transfer + 900 + 2100 + 120 items + 588 retirement out.
    expect(byPocket.get("daily-chf")).toMatchObject({
      inflow: "7800.0000",
      outflow: "6108.0000",
      residual: "1692.0000",
      fullyAllocated: false,
    });
    // Bills: funded by the transfer, fully consumed by rent — in = out.
    expect(byPocket.get("bills-chf")).toMatchObject({
      inflow: "2400.0000",
      outflow: "2400.0000",
      residual: "0.0000",
      fullyAllocated: true,
    });
    // Pillar 3a: a pure destination — the contribution arrives as inflow but is
    // not "available" money, so the residual stays zero.
    expect(byPocket.get("pillar3a-chf")).toMatchObject({
      inflow: "588.0000",
      outflow: "0.0000",
      residual: "0.0000",
      fullyAllocated: true,
    });
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
