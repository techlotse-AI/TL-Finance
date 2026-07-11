import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { projectWealth } from "@/lib/optimize/wealth-projection";
import { wealthProjectionRequestSchema } from "@/lib/optimize/schemas";

/** The feature-request fixtures are rounded whole amounts; assert ≤ ±0.5%. */
function expectWithinHalfPercent(actual: string, expected: string) {
  const relativeError = new Decimal(actual).minus(expected).abs().dividedBy(expected);
  expect(
    relativeError.lessThanOrEqualTo("0.005"),
    `${actual} is not within 0.5% of ${expected} (relative error ${relativeError.toFixed(6)})`,
  ).toBe(true);
}

// Example household from the feature request: age 43 → 65, initial 185'000,
// one-time +40'000 at month 6, 4'200/mo base contribution.
const exampleHousehold = {
  currency: "CHF",
  currentAge: 43,
  targetAge: 65,
  initialBalance: "185000",
  schedule: {
    baseMonthly: "4200",
    oneTimeInjections: [{ month: 6, amount: "40000" }],
  },
  annualReturnRates: ["0.04", "0.05", "0.07"],
};

describe("projectWealth", () => {
  it("reproduces the example-household end values at 4/5/7%", () => {
    const result = projectWealth(exampleHousehold);

    const byRate = new Map(result.series.map((series) => [series.annualReturnRate, series]));
    expectWithinHalfPercent(byRate.get("0.040000")!.endingBalance, "2289214");
    expectWithinHalfPercent(byRate.get("0.050000")!.endingBalance, "2640574");
    expectWithinHalfPercent(byRate.get("0.070000")!.endingBalance, "3540078");
  });

  it("reproduces the full-schedule fixture (step + two annual lump sums) at 5%", () => {
    const result = projectWealth({
      ...exampleHousehold,
      schedule: {
        ...exampleHousehold.schedule,
        // +675/mo from month 37 when childcare ends: steps are absolute
        // replacements, so the contribution becomes 4200 + 675 = 4875.
        steps: [{ fromMonth: 37, monthlyAmount: "4875" }],
        annualLumpSums: [
          { monthOfYear: 9, amount: "8500" },
          { monthOfYear: 3, amount: "3500" },
        ],
      },
      annualReturnRates: ["0.05"],
    });

    expectWithinHalfPercent(result.series[0]!.endingBalance, "3364660");
  });

  it("counts the initial balance as paid-in capital from point zero", () => {
    const result = projectWealth(exampleHousehold);
    const first = result.series[0]!.points[0]!;

    expect(first).toEqual({
      yearIndex: 0,
      age: 43,
      cumulativePayIns: "185000.0000",
      growth: "0.0000",
      endingBalance: "185000.0000",
    });
  });

  it("keeps pay-ins and growth separate when the return is zero", () => {
    const result = projectWealth({
      currency: "CHF",
      currentAge: 40,
      targetAge: 41,
      initialBalance: "0",
      schedule: {
        // 6 × 100 + 6 × 200 (step from month 7) = 1800, plus a 50 lump at
        // month 6 and a 500 injection at month 3 → 2350 total, zero growth.
        baseMonthly: "100",
        steps: [{ fromMonth: 7, monthlyAmount: "200" }],
        annualLumpSums: [{ monthOfYear: 6, amount: "50" }],
        oneTimeInjections: [{ month: 3, amount: "500" }],
      },
      annualReturnRates: ["0"],
    });

    expect(result.series[0]).toMatchObject({
      name: "baseline",
      annualReturnRate: "0.000000",
      monthlyReturnRate: "0.000000",
      totalPayIns: "2350.0000",
      totalGrowth: "0.0000",
      endingBalance: "2350.0000",
      deltaVsBaselineAtHorizon: null,
    });
  });

  it("applies one-time injections at the start of the month so they earn that month's growth", () => {
    // 12% annual → monthly factor (1.12)^(1/12). A 1000 injection at month 1
    // with no other flows must end the year at exactly 1000 × 1.12 = 1120.
    const result = projectWealth({
      currency: "CHF",
      currentAge: 40,
      targetAge: 41,
      initialBalance: "0",
      schedule: {
        baseMonthly: "0",
        oneTimeInjections: [{ month: 1, amount: "1000" }],
      },
      annualReturnRates: ["0.12"],
    });

    expect(result.series[0]).toMatchObject({
      totalPayIns: "1000.0000",
      totalGrowth: "120.0000",
      endingBalance: "1120.0000",
    });
  });

  it("marks the month where portfolio growth first covers the recurring contribution", () => {
    // At 5% with 4'200/mo the threshold is 4200/i ≈ 1'030'897, reached around
    // age 53–54 in the example household.
    const result = projectWealth({ ...exampleHousehold, annualReturnRates: ["0.05"] });
    const marker = result.series[0]!.growthMatchesPayIn;

    expect(marker).not.toBeNull();
    expect(marker!.age).toBeGreaterThanOrEqual(53);
    expect(marker!.age).toBeLessThanOrEqual(54.5);
    const balance = new Decimal(marker!.balance);
    expect(balance.greaterThanOrEqualTo("1030897")).toBe(true);
    // The first crossing overshoots the threshold by at most one month's flows.
    expect(balance.lessThanOrEqualTo(new Decimal("1030897").times("1.015"))).toBe(true);
  });

  it("compares levers against the baseline at the same rate", () => {
    const result = projectWealth({
      currency: "CHF",
      currentAge: 40,
      targetAge: 41,
      initialBalance: "0",
      schedule: { baseMonthly: "100" },
      annualReturnRates: ["0"],
      levers: [{ name: "Double down", schedule: { baseMonthly: "200" } }],
    });

    expect(result.series.map((series) => series.name)).toEqual(["baseline", "Double down"]);
    expect(result.series[1]).toMatchObject({
      endingBalance: "2400.0000",
      // 2400 − 1200 baseline at the same rate.
      deltaVsBaselineAtHorizon: "1200.0000",
    });
  });

  it("declares its real-terms assumptions", () => {
    const result = projectWealth(exampleHousehold);

    expect(result.assumptions).toEqual({
      compounding: "effective_monthly",
      contributionTiming: "end_of_month",
      annualLumpTiming: "end_of_month",
      oneTimeInjectionTiming: "start_of_month",
      inflationHandling: "real_terms",
      includesTaxesAndFees: false,
    });
    expect(result.horizonMonths).toBe(264);
  });
});

describe("wealthProjectionRequestSchema", () => {
  it("rejects a target age at or below the current age", () => {
    expect(() =>
      wealthProjectionRequestSchema.parse({
        currency: "CHF",
        currentAge: 43,
        targetAge: 43,
        initialBalance: "0",
        schedule: { baseMonthly: "100" },
        annualReturnRates: ["0.05"],
      }),
    ).toThrow();
  });

  it("rejects duplicate lever names and levers without overrides", () => {
    const base = {
      currency: "CHF",
      currentAge: 43,
      targetAge: 65,
      initialBalance: "0",
      schedule: { baseMonthly: "100" },
      annualReturnRates: ["0.05"],
    };

    expect(() =>
      wealthProjectionRequestSchema.parse({
        ...base,
        levers: [
          { name: "More", schedule: { baseMonthly: "200" } },
          { name: "more", schedule: { baseMonthly: "300" } },
        ],
      }),
    ).toThrow();
    expect(() =>
      wealthProjectionRequestSchema.parse({ ...base, levers: [{ name: "Empty" }] }),
    ).toThrow();
  });

  it("rejects out-of-range return rates and excessive horizons", () => {
    expect(() =>
      wealthProjectionRequestSchema.parse({
        currency: "CHF",
        currentAge: 43,
        targetAge: 65,
        initialBalance: "0",
        schedule: { baseMonthly: "100" },
        annualReturnRates: ["1.5"],
      }),
    ).toThrow();
    expect(() =>
      wealthProjectionRequestSchema.parse({
        currency: "CHF",
        currentAge: 18,
        targetAge: 110,
        initialBalance: "0",
        schedule: { baseMonthly: "100" },
        annualReturnRates: ["0.05"],
      }),
    ).toThrow();
  });
});
