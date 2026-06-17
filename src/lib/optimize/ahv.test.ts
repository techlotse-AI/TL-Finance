import { describe, expect, it } from "vitest";

import {
  computeAhvCouple,
  computeAhvPerson,
  contributionYearsFromAges,
  fullMonthlyPension,
} from "@/lib/optimize/ahv";

describe("fullMonthlyPension (Rentenformel, scale 44, 2026)", () => {
  it("returns the minimum at or below the lower income threshold", () => {
    expect(fullMonthlyPension(2026, "15120").toFixed(2)).toBe("1260.00");
    expect(fullMonthlyPension(2026, "9000").toFixed(2)).toBe("1260.00");
  });

  it("returns the maximum at or above the upper income threshold", () => {
    expect(fullMonthlyPension(2026, "90720").toFixed(2)).toBe("2520.00");
    expect(fullMonthlyPension(2026, "250000").toFixed(2)).toBe("2520.00");
  });

  it("reproduces the published value at the formula kink", () => {
    // 48 x minimum monthly = CHF 60,480 -> 1.78 x 1,260 = CHF 2,242.80
    expect(fullMonthlyPension(2026, "60480").toFixed(2)).toBe("2242.80");
  });
});

describe("contributionYearsFromAges", () => {
  it("counts from age 21 and caps at 44", () => {
    expect(contributionYearsFromAges(2026, 18, 65)).toEqual({ contributionYears: 44, missingYears: 0 });
  });

  it("reduces years for a late entrant", () => {
    expect(contributionYearsFromAges(2026, 30, 65)).toEqual({ contributionYears: 35, missingYears: 9 });
  });
});

describe("computeAhvPerson", () => {
  it("gives the full pension with 44 years and the 13th payment in 2026", () => {
    const result = computeAhvPerson({
      year: 2026,
      determiningAverageAnnualIncome: "90720",
      contributionYears: 44,
    });
    expect(result.monthlyPension).toBe("2520.0000");
    expect(result.scale).toBe("44/44");
    expect(result.annualPension).toBe("30240.0000");
    expect(result.annualPensionWithThirteenth).toBe("32760.0000");
    expect(result.thirteenthPension).toBe(true);
  });

  it("reduces the pension proportionally for contribution gaps", () => {
    const result = computeAhvPerson({
      year: 2026,
      determiningAverageAnnualIncome: "90720",
      contributionYears: 22,
    });
    expect(result.partialFactorPercent).toBe(50);
    expect(result.monthlyPension).toBe("1260.0000");
  });
});

describe("computeAhvCouple", () => {
  it("caps the combined pension at 150% of the maximum single pension", () => {
    const full = { year: 2026, determiningAverageAnnualIncome: "90720", contributionYears: 44 };
    const couple = computeAhvCouple(full, full);
    expect(couple.combinedMonthlyBeforeCap).toBe("5040.0000");
    expect(couple.monthlyCap).toBe("3780.0000");
    expect(couple.combinedMonthlyAfterCap).toBe("3780.0000");
    expect(couple.capApplied).toBe(true);
    expect(couple.combinedAnnualWithThirteenth).toBe("49140.0000");
  });

  it("does not cap when the combined pension is under the limit", () => {
    const low = { year: 2026, determiningAverageAnnualIncome: "15120", contributionYears: 44 };
    const couple = computeAhvCouple(low, low);
    expect(couple.combinedMonthlyBeforeCap).toBe("2520.0000");
    expect(couple.capApplied).toBe(false);
    expect(couple.combinedMonthlyAfterCap).toBe("2520.0000");
  });
});
