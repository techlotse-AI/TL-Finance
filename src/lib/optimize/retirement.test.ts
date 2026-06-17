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
});
