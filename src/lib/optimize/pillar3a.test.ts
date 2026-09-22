import { describe, expect, it } from "vitest";

import { computePillar3a, pillar3aMaxContribution } from "@/lib/optimize/pillar3a";

const base = {
  currency: "CHF",
  year: 2026,
  hasPensionFund: true,
  contributedThisYear: "3000",
  currentBalance: "10000",
  marginalTaxRate: "0.25",
  yearsToRetirement: 10,
  annualReturnRate: "0.03",
};

describe("pillar3aMaxContribution", () => {
  it("caps at the 2026 pension-fund maximum", () => {
    expect(pillar3aMaxContribution({ year: 2026, hasPensionFund: true }).toFixed(0)).toBe("7258");
  });

  it("caps self-employed at 20% of income up to the statutory ceiling", () => {
    expect(
      pillar3aMaxContribution({ year: 2026, hasPensionFund: false, netAnnualIncome: "50000" }).toFixed(0),
    ).toBe("10000");
    expect(
      pillar3aMaxContribution({ year: 2026, hasPensionFund: false, netAnnualIncome: "500000" }).toFixed(0),
    ).toBe("36288");
  });
});

describe("computePillar3a", () => {
  it("projects contributions, tax savings, and ending balance (hand-verified)", () => {
    const result = computePillar3a(base);
    expect(result.basis).toBe("with_pension_fund");
    expect(result.maxContribution).toBe("7258.0000");
    expect(result.remainingThisYear).toBe("4258.0000");
    expect(result.annualTaxSavingAtMax).toBe("1814.5000");
    expect(result.remainingTaxSaving).toBe("1064.5000");
    expect(result.projection.endingBalance).toBe("96643.9998");
    expect(result.projection.totalGrowth).toBe("14063.9998");
    expect(result.projection.totalTaxSaved).toBe("18145.0000");
    expect(result.assumptions.ignoresInflation).toBe(true);
    expect(result.projection.endingBalanceRealTerms).toBeUndefined();
    expect(result.assumptions.realTermsInflationRate).toBeUndefined();
  });

  it("adds a real-terms ending balance when assumedInflationRate is given, nominal figures unchanged", () => {
    const nominal = computePillar3a(base);
    const withInflation = computePillar3a({ ...base, assumedInflationRate: "0.02" });
    expect(withInflation.projection.endingBalance).toBe(nominal.projection.endingBalance);
    expect(withInflation.projection.totalGrowth).toBe(nominal.projection.totalGrowth);
    // 96643.9998 / 1.02^10, hand-verified: 79281.7410
    expect(withInflation.projection.endingBalanceRealTerms).toBe("79281.7410");
    expect(withInflation.assumptions.ignoresInflation).toBe(false);
    expect(withInflation.assumptions.realTermsInflationRate).toBe("0.020000");
  });

  it("requires net income for a self-employed contributor without a pension fund", () => {
    const result = computePillar3a({
      currency: "CHF",
      year: 2026,
      hasPensionFund: false,
      netAnnualIncome: "80000",
      contributedThisYear: "5000",
      marginalTaxRate: "0.2",
      yearsToRetirement: 5,
      annualReturnRate: "0",
    });
    expect(result.basis).toBe("self_employed");
    // 20% of 80000 = 16000; ending balance at 0% return over 5 years is just contributions.
    expect(result.maxContribution).toBe("16000.0000");
    expect(result.projection.endingBalance).toBe("80000.0000");
    expect(result.projection.totalGrowth).toBe("0.0000");
  });
});
