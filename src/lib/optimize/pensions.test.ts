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

describe("projectPensionVehicle — provider projection override (Pillar 2 / BVG)", () => {
  it("uses the provider projected capital as the ending balance", () => {
    const projection = projectPensionVehicle({
      label: "BVG (statement)",
      pillar: "PILLAR_2",
      currency: "CHF",
      currentBalance: "100000",
      annualContribution: "8000",
      annualReturnRate: "0.01",
      yearsToRetirement: 20,
      projectedCapitalOverride: "450000",
      projectedAnnualPensionOverride: "30600",
    });
    expect(projection.endingBalance).toBe("450000.0000");
    expect(projection.projectionSource).toBe("provider");
    expect(projection.providerAnnualPension).toBe("30600.0000");
    // contribution/growth split is still reported: 8000 x 20 = 160000 contributions.
    expect(projection.totalContributions).toBe("160000.0000");
    expect(projection.totalGrowth).toBe("190000.0000"); // 450000 - 100000 - 160000
  });

  it("falls back to the computed projection when no override is given", () => {
    const projection = projectPensionVehicle({
      label: "BVG (computed)",
      pillar: "PILLAR_2",
      currency: "CHF",
      currentBalance: "100000",
      annualContribution: "0",
      annualReturnRate: "0",
      yearsToRetirement: 10,
    });
    expect(projection.projectionSource).toBe("computed");
    expect(projection.providerAnnualPension).toBeNull();
    expect(projection.endingBalance).toBe("100000.0000");
  });

  it("ignores a zero override and stays computed", () => {
    const projection = projectPensionVehicle({
      label: "BVG",
      pillar: "PILLAR_2",
      currency: "CHF",
      currentBalance: "50000",
      annualContribution: "0",
      annualReturnRate: "0",
      yearsToRetirement: 5,
      projectedCapitalOverride: "0",
    });
    expect(projection.projectionSource).toBe("computed");
    expect(projection.endingBalance).toBe("50000.0000");
  });
});

describe("summarizePensions — provider pensions", () => {
  it("sums provider-stated annual pensions and uses override capital in the total", () => {
    const summary = summarizePensions({
      currency: "CHF",
      vehicles: [
        {
          label: "BVG",
          pillar: "PILLAR_2",
          currency: "CHF",
          currentBalance: "100000",
          annualContribution: "0",
          annualReturnRate: "0",
          yearsToRetirement: 10,
          projectedCapitalOverride: "400000",
          projectedAnnualPensionOverride: "27000",
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
    expect(summary.totalCapitalAtRetirement).toBe("450000.0000"); // 400000 + 50000
    expect(summary.totalProviderAnnualPension).toBe("27000.0000");
  });
});
