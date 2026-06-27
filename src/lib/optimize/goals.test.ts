import { describe, expect, it } from "vitest";

import { computeGoals, monthsUntil, type GoalInput } from "@/lib/optimize/goals";

describe("monthsUntil", () => {
  it("counts whole months, dropping a partial trailing month", () => {
    expect(monthsUntil(new Date("2026-01-15T00:00:00Z"), new Date("2026-07-15T00:00:00Z"))).toBe(6);
    expect(monthsUntil(new Date("2026-01-15T00:00:00Z"), new Date("2026-07-14T00:00:00Z"))).toBe(5);
    expect(monthsUntil(new Date("2026-01-15T00:00:00Z"), new Date("2027-01-15T00:00:00Z"))).toBe(12);
  });

  it("never returns a negative number", () => {
    expect(monthsUntil(new Date("2026-07-15T00:00:00Z"), new Date("2026-01-15T00:00:00Z"))).toBe(0);
  });
});

const single = (goal: GoalInput, rates: Record<string, string> = {}) =>
  computeGoals({ reportingCurrency: "CHF", rates, goals: [goal] }).goals[0];

describe("computeGoals — per-goal status", () => {
  it("marks a goal reached when saved meets the target", () => {
    const g = single({
      name: "Holiday",
      currency: "CHF",
      targetAmount: "2000",
      currentAmount: "2000",
      monthsRemaining: 5,
    });
    expect(g.status).toBe("reached");
    expect(g.remainingAmount).toBe("0.0000");
    expect(g.requiredMonthlyContribution).toBe("0.0000");
    expect(g.progressPercent).toBe(100);
  });

  it("computes required monthly = remaining / months and rounds it UP to 5", () => {
    const g = single({
      name: "Car fund",
      currency: "CHF",
      targetAmount: "12000",
      currentAmount: "0",
      monthsRemaining: 11, // 12000/11 = 1090.9090...
    });
    expect(g.requiredMonthlyContribution).toBe("1090.9091");
    expect(g.requiredMonthlyContributionRounded).toBe("1095.0000"); // ceil to nearest 5
    expect(g.status).toBe("behind"); // no planned contribution
  });

  it("is on_track when planned is within ±5 of required", () => {
    const g = single({
      name: "Deposit",
      currency: "CHF",
      targetAmount: "6000",
      currentAmount: "0",
      monthsRemaining: 12, // required 500/month
      plannedMonthlyContribution: "503",
    });
    expect(g.requiredMonthlyContribution).toBe("500.0000");
    expect(g.status).toBe("on_track");
    expect(g.monthlyShortfall).toBe("3.0000");
  });

  it("is ahead when planned comfortably exceeds required", () => {
    const g = single({
      name: "Deposit",
      currency: "CHF",
      targetAmount: "6000",
      currentAmount: "0",
      monthsRemaining: 12, // required 500/month
      plannedMonthlyContribution: "600",
    });
    expect(g.status).toBe("ahead");
    expect(g.monthlyShortfall).toBe("100.0000");
    expect(g.monthsAtPlannedRate).toBe(10); // 6000/600
  });

  it("is behind when planned falls short beyond tolerance", () => {
    const g = single({
      name: "Deposit",
      currency: "CHF",
      targetAmount: "6000",
      currentAmount: "0",
      monthsRemaining: 12, // required 500/month
      plannedMonthlyContribution: "400",
    });
    expect(g.status).toBe("behind");
    expect(g.monthlyShortfall).toBe("-100.0000");
  });

  it("is no_target_date for an open-ended goal", () => {
    const g = single({
      name: "Rainy day",
      currency: "CHF",
      targetAmount: "10000",
      currentAmount: "2500",
      monthsRemaining: null,
      plannedMonthlyContribution: "250",
    });
    expect(g.status).toBe("no_target_date");
    expect(g.requiredMonthlyContribution).toBeNull();
    expect(g.monthsAtPlannedRate).toBe(30); // 7500/250
    expect(g.progressPercent).toBe(25);
  });

  it("is unreachable when the date has passed and the goal is unmet", () => {
    const g = single({
      name: "Late goal",
      currency: "CHF",
      targetAmount: "1000",
      currentAmount: "200",
      monthsRemaining: 0,
    });
    expect(g.status).toBe("unreachable");
    expect(g.requiredMonthlyContribution).toBe("800.0000");
    expect(g.remainingAmount).toBe("800.0000");
  });
});

describe("computeGoals — summary and multi-currency", () => {
  it("aggregates targets/saved/required in the reporting currency", () => {
    const result = computeGoals({
      reportingCurrency: "CHF",
      rates: { EUR: "0.95" },
      goals: [
        { name: "A", currency: "CHF", targetAmount: "6000", currentAmount: "0", monthsRemaining: 12 }, // req 500
        { name: "B", currency: "EUR", targetAmount: "2000", currentAmount: "1000", monthsRemaining: 10 }, // rem 1000 EUR -> req 100 EUR/mo -> 95 CHF
      ],
    });
    expect(result.summary.goalCount).toBe(2);
    // targets: 6000 + 2000*0.95 = 7900
    expect(result.summary.totalTarget).toBe("7900.0000");
    // saved: 0 + 1000*0.95 = 950
    expect(result.summary.totalSaved).toBe("950.0000");
    // required monthly: 500 + (100*0.95) = 595
    expect(result.summary.totalRequiredMonthly).toBe("595.0000");
    expect(result.summary.overallProgressPercent).toBe(Number((950 / 7900 * 100).toFixed(2)));
  });

  it("excludes goals whose currency has no rate from the totals", () => {
    const result = computeGoals({
      reportingCurrency: "CHF",
      rates: {},
      goals: [
        { name: "CHF goal", currency: "CHF", targetAmount: "1000", currentAmount: "500", monthsRemaining: 5 },
        { name: "GBP goal", currency: "GBP", targetAmount: "5000", currentAmount: "0", monthsRemaining: 10 },
      ],
    });
    expect(result.summary.totalTarget).toBe("1000.0000");
    expect(result.summary.missingRateCurrencies).toEqual(["GBP"]);
    // The GBP goal is still computed per-goal in its own currency.
    expect(result.goals.find((g) => g.currency === "GBP")!.requiredMonthlyContribution).toBe("500.0000");
  });
});
