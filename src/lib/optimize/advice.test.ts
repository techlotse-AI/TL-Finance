import { describe, expect, it } from "vitest";

import { computeEmergencyFund } from "@/lib/optimize/emergency-fund";
import { computePillar3a } from "@/lib/optimize/pillar3a";
import { computeRecommendations } from "@/lib/optimize/recommendations";

describe("computeEmergencyFund", () => {
  it("computes target, gap, runway, and suggested top-up", () => {
    const result = computeEmergencyFund({ currency: "CHF", essentialMonthly: "4000.00", currentReserve: "6000.00", targetMonths: 6 });
    expect(result.targetAmount).toBe("24000.0000");
    expect(result.gap).toBe("18000.0000");
    expect(result.monthsCovered).toBe(1.5);
    expect(result.status).toBe("partial");
    expect(result.suggestedMonthlyContribution).toBe("1500.0000");
  });

  it("is funded when reserve meets the target", () => {
    const result = computeEmergencyFund({ currency: "CHF", essentialMonthly: "3000.00", currentReserve: "20000.00", targetMonths: 6 });
    expect(result.status).toBe("funded");
    expect(result.gap).toBe("0.0000");
  });
});

describe("computePillar3a", () => {
  it("uses the 2026 maximum with a pension fund and projects growth", () => {
    const result = computePillar3a({
      currency: "CHF", year: 2026, hasPensionFund: true, contributedThisYear: "0",
      marginalTaxRate: "0.25", yearsToRetirement: 30, annualReturnRate: "0.03",
    });
    expect(result.maxContribution).toBe("7258.0000");
    expect(result.remainingThisYear).toBe("7258.0000");
    expect(result.annualTaxSavingAtMax).toBe("1814.5000");
    expect(Number(result.projection.endingBalance)).toBeGreaterThan(Number(result.projection.totalContributions));
  });

  it("applies the 20% self-employed cap", () => {
    const low = computePillar3a({ currency: "CHF", year: 2026, hasPensionFund: false, netAnnualIncome: "30000", contributedThisYear: "1000", marginalTaxRate: "0.2", yearsToRetirement: 10, annualReturnRate: "0.02" });
    expect(low.maxContribution).toBe("6000.0000");
    expect(low.remainingThisYear).toBe("5000.0000");

    const high = computePillar3a({ currency: "CHF", year: 2026, hasPensionFund: false, netAnnualIncome: "300000", contributedThisYear: "0", marginalTaxRate: "0.3", yearsToRetirement: 10, annualReturnRate: "0.02" });
    expect(high.maxContribution).toBe("36288.0000");
  });
});

describe("computeRecommendations", () => {
  it("ranks emergency fund, Pillar 3a, then findings, each with a basis", () => {
    const emergencyFund = computeEmergencyFund({ currency: "CHF", essentialMonthly: "4000", currentReserve: "6000", targetMonths: 6 });
    const pillar3a = computePillar3a({ currency: "CHF", year: 2026, hasPensionFund: true, contributedThisYear: "0", marginalTaxRate: "0.25", yearsToRetirement: 30, annualReturnRate: "0.03" });
    const recommendations = computeRecommendations({
      emergencyFund,
      pillar3a,
      findings: [{ code: "over_budget", severity: "warning", title: "Over budget: Dining", detail: "Spent more than planned.", currency: "CHF", amount: "120.0000" }],
    });
    expect(recommendations[0].code).toBe("build_emergency_fund");
    expect(recommendations.map((r) => r.code)).toContain("use_pillar_3a_allowance");
    expect(recommendations.map((r) => r.code)).toContain("reduce_overspend");
    expect(recommendations.every((r) => r.basis.length > 0)).toBe(true);
  });
});
