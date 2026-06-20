import { describe, expect, it } from "vitest";

import {
  computeEmergencyFund,
  swissUnemploymentProtection,
} from "@/lib/optimize/emergency-fund";

describe("computeEmergencyFund — no income protection (regression guard)", () => {
  it("reproduces the classic essential x months target", () => {
    const result = computeEmergencyFund({
      currency: "CHF",
      essentialMonthly: "4000.00",
      currentReserve: "6000.00",
      targetMonths: 6,
    });
    expect(result.targetAmount).toBe("24000.0000");
    expect(result.unInsuredTargetAmount).toBe("24000.0000");
    expect(result.gap).toBe("18000.0000");
    expect(result.monthsCovered).toBe(1.5);
    expect(result.fundedPercent).toBe(25);
    expect(result.status).toBe("partial");
    expect(result.suggestedMonthlyContribution).toBe("1500.0000");
    expect(result.incomeProtectionApplied).toBe(false);
    expect(result.protectionReduction).toBe("0.0000");
    expect(result.protectionExplanation).toBeNull();
    expect(result.protectionBasis).toEqual([]);
  });

  it("never reduces the target when the benefit is zero", () => {
    const result = computeEmergencyFund({
      currency: "CHF",
      essentialMonthly: "3000",
      currentReserve: "0",
      targetMonths: 6,
      incomeProtection: { monthlyBenefit: "0", waitingPeriodMonths: 2 },
    });
    expect(result.targetAmount).toBe("18000.0000");
    expect(result.incomeProtectionApplied).toBe(false);
    expect(result.protectionReduction).toBe("0.0000");
  });
});

describe("computeEmergencyFund — generic income protection", () => {
  it("self-funds only the waiting window when the benefit fully covers essential", () => {
    const result = computeEmergencyFund({
      currency: "CHF",
      essentialMonthly: "3000",
      currentReserve: "0",
      targetMonths: 6,
      incomeProtection: { monthlyBenefit: "3000", waitingPeriodMonths: 2 },
    });
    // 2 waiting months x 3000, then fully covered.
    expect(result.targetAmount).toBe("6000.0000");
    expect(result.unInsuredTargetAmount).toBe("18000.0000");
    expect(result.protectionReduction).toBe("12000.0000");
    expect(result.incomeProtectionApplied).toBe(true);
    expect(result.protectionExplanation).toContain("reduces the required reserve");
  });

  it("reduces post-waiting months by the benefit when it partly covers essential", () => {
    const result = computeEmergencyFund({
      currency: "CHF",
      essentialMonthly: "4000",
      currentReserve: "0",
      targetMonths: 6,
      incomeProtection: { monthlyBenefit: "2500", waitingPeriodMonths: 1 },
    });
    // month 1: 4000; months 2-6: max(4000-2500,0)=1500 x5 = 7500 -> 11500.
    expect(result.targetAmount).toBe("11500.0000");
    expect(result.protectionReduction).toBe("12500.0000");
  });

  it("caps the benefit offset at essential spend (benefit >= essential)", () => {
    const result = computeEmergencyFund({
      currency: "CHF",
      essentialMonthly: "3000",
      currentReserve: "0",
      targetMonths: 6,
      incomeProtection: { monthlyBenefit: "5000", waitingPeriodMonths: 2 },
    });
    expect(result.targetAmount).toBe("6000.0000");
  });

  it("re-exposes full essential after the benefit duration is exhausted", () => {
    const result = computeEmergencyFund({
      currency: "CHF",
      essentialMonthly: "2000",
      currentReserve: "0",
      targetMonths: 6,
      incomeProtection: { monthlyBenefit: "2000", waitingPeriodMonths: 0, benefitDurationMonths: 2 },
    });
    // months 1-2 fully covered; months 3-6 exhausted -> 2000 x4 = 8000.
    expect(result.targetAmount).toBe("8000.0000");
    expect(result.protectionReduction).toBe("4000.0000");
  });

  it("honours coversPercentOfEssential as an explicit benefit cap", () => {
    const result = computeEmergencyFund({
      currency: "CHF",
      essentialMonthly: "4000",
      currentReserve: "0",
      targetMonths: 3,
      incomeProtection: { monthlyBenefit: "5000", waitingPeriodMonths: 0, coversPercentOfEssential: "0.5" },
    });
    // capped benefit = 2000; each month max(4000-2000,0)=2000 x3 = 6000.
    expect(result.targetAmount).toBe("6000.0000");
    expect(result.protectionBasis).toContain("incomeProtection.coversPercentOfEssential");
  });

  it("treats full-coverage (notice/severance) months as needing no reserve", () => {
    const result = computeEmergencyFund({
      currency: "CHF",
      essentialMonthly: "3000",
      currentReserve: "0",
      targetMonths: 6,
      incomeProtection: { monthlyBenefit: "0", waitingPeriodMonths: 0, fullCoverageMonths: 3 },
    });
    // months 1-3 covered; months 4-6 full essential -> 3000 x3 = 9000.
    expect(result.targetAmount).toBe("9000.0000");
  });
});

describe("swissUnemploymentProtection (ALV/AC, 2026)", () => {
  it("derives a 70% benefit on the insured salary with Swiss defaults", () => {
    const protection = swissUnemploymentProtection({ monthlyGrossSalary: "8000" });
    expect(protection.monthlyBenefit).toBe("5600.0000");
    expect(protection.waitingPeriodMonths).toBe(2);
    expect(protection.benefitDurationMonths).toBe(24);
    expect(protection.fullCoverageMonths).toBe(3);
  });

  it("applies the 80% rate and caps the insured salary at the ALV maximum", () => {
    const protection = swissUnemploymentProtection({ monthlyGrossSalary: "20000", higherRate: true });
    // min(20000, 12350) x 0.80 = 9880.
    expect(protection.monthlyBenefit).toBe("9880.0000");
  });

  it("sizes an emergency fund: 3-month notice + 2-month wait, then 70% covers essential", () => {
    const protection = swissUnemploymentProtection({ monthlyGrossSalary: "8000" });
    const result = computeEmergencyFund({
      currency: "CHF",
      essentialMonthly: "4000",
      currentReserve: "0",
      targetMonths: 6,
      incomeProtection: protection,
    });
    // months 1-3 notice (0); months 4-5 wait (4000 each); month 6 benefit 5600 >= 4000 (0). -> 8000.
    expect(result.targetAmount).toBe("8000.0000");
    expect(result.unInsuredTargetAmount).toBe("24000.0000");
    expect(result.protectionReduction).toBe("16000.0000");
    expect(result.incomeProtectionApplied).toBe(true);
  });
});
