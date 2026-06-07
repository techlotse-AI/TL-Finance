import { describe, expect, it } from "vitest";

import { compareProjectionScenarios } from "@/lib/optimize/projection";
import { projectionComparisonSchema } from "@/lib/optimize/schemas";

describe("compareProjectionScenarios", () => {
  it("keeps contributions and growth separate when the return is zero", () => {
    const result = compareProjectionScenarios({
      currency: "CHF",
      startingAmount: "1000",
      monthlyContribution: "100",
      years: 2,
      scenarios: [{ name: "No growth", annualReturnRate: "0" }],
    });

    expect(result.scenarios[0]).toMatchObject({
      annualReturnRate: "0.000000",
      monthlyReturnRate: "0.000000",
      totalContributions: "3400.0000",
      totalGrowth: "0.0000",
      endingBalance: "3400.0000",
    });
    expect(result.scenarios[0]?.points).toEqual([
      { year: 0, contributedPrincipal: "1000.0000", growth: "0.0000", endingBalance: "1000.0000" },
      { year: 1, contributedPrincipal: "2200.0000", growth: "0.0000", endingBalance: "2200.0000" },
      { year: 2, contributedPrincipal: "3400.0000", growth: "0.0000", endingBalance: "3400.0000" },
    ]);
  });

  it("uses effective monthly compounding and end-of-month contributions", () => {
    const result = compareProjectionScenarios({
      currency: "CHF",
      startingAmount: "10000",
      monthlyContribution: "500",
      years: 1,
      scenarios: [{ name: "Base", annualReturnRate: "0.12" }],
    });

    expect(result.assumptions).toEqual({
      compounding: "effective_monthly",
      contributionTiming: "end_of_month",
      includesTaxesAndFees: false,
    });
    expect(result.scenarios[0]).toMatchObject({
      annualReturnRate: "0.120000",
      monthlyReturnRate: "0.009489",
      totalContributions: "16000.0000",
      endingBalance: "17523.2490",
      totalGrowth: "1523.2490",
    });
  });

  it("preserves negative-return scenarios without hiding losses", () => {
    const result = compareProjectionScenarios({
      currency: "CHF",
      startingAmount: "10000",
      monthlyContribution: "0",
      years: 1,
      scenarios: [{ name: "Downside", annualReturnRate: "-0.20" }],
    });

    expect(result.scenarios[0]).toMatchObject({
      totalContributions: "10000.0000",
      totalGrowth: "-2000.0000",
      endingBalance: "8000.0000",
    });
  });
});

describe("projectionComparisonSchema", () => {
  it("rejects duplicate names, invalid rates, and excessive horizons", () => {
    expect(() =>
      projectionComparisonSchema.parse({
        currency: "CHF",
        startingAmount: "0",
        monthlyContribution: "100",
        years: 61,
        scenarios: [
          { name: "Base", annualReturnRate: "1.01" },
          { name: "base", annualReturnRate: "0.05" },
        ],
      }),
    ).toThrow();
  });
});
