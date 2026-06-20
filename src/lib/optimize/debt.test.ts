import { describe, expect, it } from "vitest";

import { computeDebtComparison, computeDebtPayoff } from "@/lib/optimize/debt";

const asOf = new Date(Date.UTC(2026, 0, 15)); // fixed for deterministic payoff dates

describe("computeDebtPayoff — single debt", () => {
  it("clears a zero-interest debt in balance / payment months", () => {
    const result = computeDebtPayoff({
      currency: "CHF",
      strategy: "avalanche",
      asOf,
      debts: [{ name: "Loan", balance: "1200", annualInterestRate: "0", minimumPayment: "100" }],
    });
    expect(result.amortizes).toBe(true);
    expect(result.months).toBe(12);
    expect(result.totalInterest).toBe("0.0000");
    expect(result.totalPaid).toBe("1200.0000");
    expect(result.payoffDate).toBe("2027-01-15");
  });

  it("accrues nominal APR monthly and clears with an extra payment", () => {
    const result = computeDebtPayoff({
      currency: "CHF",
      strategy: "avalanche",
      asOf,
      extraMonthlyPayment: "1000",
      debts: [{ name: "Card", balance: "1000", annualInterestRate: "0.12", minimumPayment: "0" }],
    });
    // month1: +10 interest, pay 1000 -> 10 left; month2: +0.10, pay 10.10 -> 0.
    expect(result.months).toBe(2);
    expect(result.totalInterest).toBe("10.1000");
    expect(result.totalPaid).toBe("1010.1000");
  });
});

describe("computeDebtPayoff — strategy ordering", () => {
  const debts = [
    { name: "Card", balance: "2000", annualInterestRate: "0.20", minimumPayment: "50" },
    { name: "Store", balance: "500", annualInterestRate: "0.05", minimumPayment: "50" },
  ];

  it("avalanche targets the highest rate first", () => {
    const result = computeDebtPayoff({ currency: "CHF", strategy: "avalanche", extraMonthlyPayment: "200", debts, asOf });
    expect(result.debts[0].name).toBe("Card");
    expect(result.debts[0].order).toBe(1);
    expect(result.amortizes).toBe(true);
  });

  it("snowball targets the smallest balance first", () => {
    const result = computeDebtPayoff({ currency: "CHF", strategy: "snowball", extraMonthlyPayment: "200", debts, asOf });
    expect(result.debts[0].name).toBe("Store");
    expect(result.debts[0].order).toBe(1);
    expect(result.amortizes).toBe(true);
  });
});

describe("computeDebtPayoff — rollover of freed minimums (zero interest)", () => {
  it("rolls a cleared debt's minimum into the next focus debt", () => {
    const result = computeDebtPayoff({
      currency: "CHF",
      strategy: "snowball",
      asOf,
      debts: [
        { name: "A", balance: "100", annualInterestRate: "0", minimumPayment: "50" },
        { name: "B", balance: "300", annualInterestRate: "0", minimumPayment: "50" },
      ],
    });
    // Constant budget 100, total 400 -> 4 months. A clears month 2, B month 4.
    expect(result.months).toBe(4);
    expect(result.totalInterest).toBe("0.0000");
    const a = result.debts.find((debt) => debt.name === "A")!;
    const b = result.debts.find((debt) => debt.name === "B")!;
    expect(a.payoffMonth).toBe(2);
    expect(b.payoffMonth).toBe(4);
  });
});

describe("computeDebtPayoff — min-payment-below-interest guard", () => {
  it("flags a non-amortizing debt and reports no payoff date", () => {
    const result = computeDebtPayoff({
      currency: "CHF",
      strategy: "avalanche",
      asOf,
      maxMonths: 12,
      debts: [{ name: "Card", balance: "10000", annualInterestRate: "0.24", minimumPayment: "100" }],
    });
    expect(result.amortizes).toBe(false);
    expect(result.months).toBeNull();
    expect(result.payoffDate).toBeNull();
    expect(result.notes.some((note) => note.includes("below its monthly interest"))).toBe(true);
    expect(result.notes.some((note) => note.includes("does not clear"))).toBe(true);
  });
});

describe("computeDebtComparison", () => {
  it("quantifies avalanche savings and recommends the cheaper strategy", () => {
    const comparison = computeDebtComparison({
      currency: "CHF",
      extraMonthlyPayment: "200",
      asOf,
      debts: [
        { name: "Card", balance: "2000", annualInterestRate: "0.20", minimumPayment: "50" },
        { name: "Store", balance: "500", annualInterestRate: "0.05", minimumPayment: "50" },
      ],
    });
    expect(comparison.avalanche.amortizes).toBe(true);
    expect(comparison.snowball.amortizes).toBe(true);
    expect(Number(comparison.interestSavedByAvalanche)).toBeGreaterThanOrEqual(0);
    expect(comparison.monthsSavedByAvalanche).not.toBeNull();
    expect(comparison.recommendedStrategy).toBe("avalanche");
  });
});
