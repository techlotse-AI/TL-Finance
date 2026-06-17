import { describe, expect, it } from "vitest";

import { projectPensionVehicle, summarizePensions } from "@/lib/optimize/pensions";

describe("projectPensionVehicle", () => {
  it("adds contributions without growth at a zero return", () => {
    const projection = projectPensionVehicle({
      label: "Vested benefits",
      pillar: "PILLAR_2",
      currency: "CHF",
      currentBalance: "1000",
      annualContribution: "100",
      annualReturnRate: "0",
      yearsToRetirement: 5,
    });
    expect(projection.totalContributions).toBe("500.0000");
    expect(projection.totalGrowth).toBe("0.0000");
    expect(projection.endingBalance).toBe("1500.0000");
  });

  it("keeps ending balance equal to start + contributions + growth", () => {
    const projection = projectPensionVehicle({
      label: "3a",
      pillar: "PILLAR_3A",
      currency: "CHF",
      currentBalance: "10000",
      annualContribution: "7258",
      annualReturnRate: "0.03",
      yearsToRetirement: 10,
    });
    const reconstructed =
      10000 + Number(projection.totalContributions) + Number(projection.totalGrowth);
    expect(Number(projection.endingBalance)).toBeCloseTo(reconstructed, 4);
    expect(Number(projection.endingBalance)).toBeGreaterThan(10000 + 72580);
  });
});

describe("summarizePensions", () => {
  it("totals capital across pillars and carries AHV income", () => {
    const summary = summarizePensions({
      currency: "CHF",
      ahvAnnualIncome: "30240",
      vehicles: [
        {
          label: "BVG",
          pillar: "PILLAR_2",
          currency: "CHF",
          currentBalance: "100000",
          annualContribution: "0",
          annualReturnRate: "0",
          yearsToRetirement: 10,
        },
        {
          label: "3a",
          pillar: "PILLAR_3A",
          currency: "CHF",
          currentBalance: "50000",
          annualContribution: "0",
          annualReturnRate: "0",
          yearsToRetirement: 10,
        },
      ],
    });
    expect(summary.totalCapitalAtRetirement).toBe("150000.0000");
    expect(summary.ahvAnnualIncome).toBe("30240.0000");
    expect(summary.capitalByPillar).toHaveLength(2);
  });
});
