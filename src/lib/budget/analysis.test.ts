import { describe, expect, it } from "vitest";

import { computeBudgetAnalysis, type BudgetLineInput } from "@/lib/budget/analysis";

function lines(): BudgetLineInput[] {
  return [
    { name: "Salary", group: "Income", category: "Salary", kind: "INCOME", essential: false, monthlyAmount: "8000" },
    { name: "Rent", group: "Housing", category: "Rent", kind: "EXPENSE", essential: true, monthlyAmount: "2400" },
    { name: "Health insurance", group: "Insurance", category: "Health", kind: "EXPENSE", essential: true, monthlyAmount: "600" },
    { name: "Groceries", group: "Food", category: "Groceries", kind: "EXPENSE", essential: true, monthlyAmount: "800" },
    { name: "Dining out", group: "Food", category: "Restaurants", kind: "EXPENSE", essential: false, monthlyAmount: "700" },
    { name: "Streaming", group: "Leisure", category: "Subscriptions", kind: "EXPENSE", essential: false, monthlyAmount: "500" },
    { name: "Pillar 3a", group: "Savings", category: "Pillar 3a", kind: "RETIREMENT", essential: false, monthlyAmount: "590" },
    { name: "Emergency fund", group: "Savings", category: "Buffer", kind: "SAVING", essential: false, monthlyAmount: "1000" },
  ];
}

describe("computeBudgetAnalysis — totals", () => {
  it("sums income, expense, and saving allocations and the net", () => {
    const r = computeBudgetAnalysis({ reportingCurrency: "CHF", lines: lines() });
    expect(r.totalIncome).toBe("8000.0000");
    expect(r.totalExpense).toBe("5000.0000"); // 2400+600+800+700+500
    expect(r.totalSavingAllocations).toBe("1590.0000"); // 590 + 1000
    expect(r.netMonthly).toBe("1410.0000"); // 8000 - 5000 - 1590
    expect(r.balancesToZero).toBe(false);
  });

  it("computes the savings rate including unallocated surplus", () => {
    const r = computeBudgetAnalysis({ reportingCurrency: "CHF", lines: lines() });
    // (1590 + 1410) / 8000 = 37.5
    expect(r.savingsRatePercent).toBe(37.5);
  });

  it("computes the essential ratio of expenses", () => {
    const r = computeBudgetAnalysis({ reportingCurrency: "CHF", lines: lines() });
    // essential 2400+600+800 = 3800 / 5000 = 76
    expect(r.essentialMonthly).toBe("3800.0000");
    expect(r.essentialRatioPercent).toBe(76);
  });
});

describe("computeBudgetAnalysis — breakdowns", () => {
  it("ranks top spend categories by amount", () => {
    const r = computeBudgetAnalysis({ reportingCurrency: "CHF", lines: lines() });
    expect(r.topSpendCategories[0].label).toBe("Rent");
    expect(r.topSpendCategories[0].monthlyRounded).toBe(2400);
    expect(r.topSpendCategories[0].percentOfExpense).toBe(48); // 2400/5000
  });

  it("groups spend by category group", () => {
    const r = computeBudgetAnalysis({ reportingCurrency: "CHF", lines: lines() });
    const food = r.spendByGroup.find((g) => g.label === "Food")!;
    expect(food.monthly).toBe("1500.0000"); // 800 + 700
  });
});

describe("computeBudgetAnalysis — 50/30/20 guideline", () => {
  it("compares needs, wants and savings to their targets", () => {
    const r = computeBudgetAnalysis({ reportingCurrency: "CHF", lines: lines() });
    // needs 3800 / 8000 = 47.5% (target 50 -> under, room 200)
    expect(r.needsWantsSavings.needs.actualPercent).toBe(47.5);
    expect(r.needsWantsSavings.needs.varianceMonthly).toBe("200.0000");
    expect(r.needsWantsSavings.needs.status).toBe("under");
    // wants 1200 / 8000 = 15% (target 30 -> under)
    expect(r.needsWantsSavings.wants.actualPercent).toBe(15);
    // savings bucket 1590 + 1410 = 3000 / 8000 = 37.5% (target 20 -> over the line means more than target)
    expect(r.needsWantsSavings.savings.actualPercent).toBe(37.5);
    expect(r.needsWantsSavings.savings.status).toBe("over");
  });
});

describe("computeBudgetAnalysis — savings opportunities", () => {
  it("flags discretionary categories above 5% of income with a 15% trim", () => {
    const r = computeBudgetAnalysis({ reportingCurrency: "CHF", lines: lines() });
    const dining = r.savingsOpportunities.find((o) => o.category === "Restaurants")!;
    expect(dining.percentOfIncome).toBe(8.75); // 700/8000
    expect(dining.suggestedMonthlySaving).toBe(105); // 700*0.15 = 105 -> nearest 5
    // Essential categories are never opportunities.
    expect(r.savingsOpportunities.find((o) => o.category === "Rent")).toBeUndefined();
  });
});

describe("computeBudgetAnalysis — zero-based balance within ±5", () => {
  it("treats a residual within ±5 as balanced", () => {
    const r = computeBudgetAnalysis({
      reportingCurrency: "CHF",
      lines: [
        { name: "Salary", group: "Income", category: "Salary", kind: "INCOME", essential: false, monthlyAmount: "5000" },
        { name: "Rent", group: "Housing", category: "Rent", kind: "EXPENSE", essential: true, monthlyAmount: "4997" },
      ],
    });
    // net = 3, within tolerance
    expect(r.netMonthly).toBe("3.0000");
    expect(r.balancesToZero).toBe(true);
  });

  it("is not balanced once the residual exceeds ±5", () => {
    const r = computeBudgetAnalysis({
      reportingCurrency: "CHF",
      lines: [
        { name: "Salary", group: "Income", category: "Salary", kind: "INCOME", essential: false, monthlyAmount: "5000" },
        { name: "Rent", group: "Housing", category: "Rent", kind: "EXPENSE", essential: true, monthlyAmount: "4990" },
      ],
    });
    expect(r.netMonthly).toBe("10.0000");
    expect(r.balancesToZero).toBe(false);
  });
});
