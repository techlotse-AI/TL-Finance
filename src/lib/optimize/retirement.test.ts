import { describe, expect, it } from "vitest";

import { computeRetirementReadiness } from "@/lib/optimize/retirement";

const base = {
  currency: "CHF",
  ahvAnnualIncome: "30000",
  pensionCapitalAtRetirement: "500000",
  investmentCapitalAtRetirement: "100000",
  pensionAnnuitizationRate: "0.05",
  investmentDrawdownRate: "0.04",
  yearsInRetirement: 20,
  yearsToRetirement: 20,
  preRetirementReturnRate: "0.03",
};

describe("computeRetirementReadiness", () => {
  it("combines AHV, annuitized pension capital, and investment drawdown", () => {
    const result = computeRetirementReadiness({ ...base, targetAnnualIncome: "80000" });
    // 30000 + 500000*0.05 (25000) + 100000*0.04 (4000) = 59000
    expect(result.projectedAnnualIncome).toBe("59000.0000");
    expect(result.annualGap).toBe("21000.0000");
    expect(result.coveragePercent).toBe(73.8);
    expect(result.status).toBe("shortfall");
    expect(result.additionalCapitalNeeded).toBe("420000.0000");
    expect(Number(result.requiredMonthlySaving)).toBeGreaterThan(0);
  });

  it("reports on_track with no gap and zero required saving", () => {
    const result = computeRetirementReadiness({ ...base, targetAnnualIncome: "50000" });
    expect(result.annualGap).toBe("0.0000");
    expect(result.status).toBe("on_track");
    expect(result.requiredMonthlySaving).toBe("0.0000");
  });

  it("derives the target from a replacement ratio", () => {
    const result = computeRetirementReadiness({
      ...base,
      currentNetAnnualIncome: "100000",
      replacementRatio: "0.6",
    });
    expect(result.targetAnnualIncome).toBe("60000.0000");
  });

  it("sizes required saving without growth at a zero return", () => {
    const result = computeRetirementReadiness({
      ...base,
      targetAnnualIncome: "80000",
      preRetirementReturnRate: "0",
    });
    // 420000 capital / (20*12) months = 1750/month
    expect(result.requiredMonthlySaving).toBe("1750.0000");
  });

  it("adds real-terms figures when assumedInflationRate is given, nominal figures unchanged", () => {
    const nominal = computeRetirementReadiness({ ...base, targetAnnualIncome: "80000" });
    const withInflation = computeRetirementReadiness({
      ...base,
      targetAnnualIncome: "80000",
      assumedInflationRate: "0.02",
    });
    expect(withInflation.projectedAnnualIncome).toBe(nominal.projectedAnnualIncome);
    expect(withInflation.annualGap).toBe(nominal.annualGap);
    expect(withInflation.additionalCapitalNeeded).toBe(nominal.additionalCapitalNeeded);
    expect(withInflation.requiredMonthlySaving).toBe(nominal.requiredMonthlySaving);
    // Deflated by 1.02^20, hand-verified.
    expect(withInflation.realTermsProjectedAnnualIncome).toBe("39705.3087");
    expect(withInflation.realTermsAnnualGap).toBe("14132.3980");
    expect(withInflation.realTermsAdditionalCapitalNeeded).toBe("282647.9599");
    expect(withInflation.assumptions.ignoresInflation).toBe(false);
    expect(withInflation.assumptions.realTermsInflationRate).toBe("0.020000");
  });

  it("omits real-terms figures when assumedInflationRate is not given", () => {
    const result = computeRetirementReadiness({ ...base, targetAnnualIncome: "80000" });
    expect(result.realTermsProjectedAnnualIncome).toBeUndefined();
    expect(result.realTermsAnnualGap).toBeUndefined();
    expect(result.realTermsAdditionalCapitalNeeded).toBeUndefined();
    expect(result.assumptions.ignoresInflation).toBe(true);
    expect(result.assumptions.realTermsInflationRate).toBeUndefined();
  });
});
