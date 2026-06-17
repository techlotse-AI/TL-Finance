import { describe, expect, it } from "vitest";

import { computeBalanceForecast } from "@/lib/optimize/forecast";

describe("computeBalanceForecast", () => {
  it("projects a surplus with no shortfall", () => {
    const result = computeBalanceForecast({
      currency: "CHF",
      startingBalance: "1000",
      monthlyNetFlow: "100",
      months: 12,
    });
    expect(result.endingBalance).toBe("2200.0000");
    expect(result.lowestBalance).toBe("1000.0000");
    expect(result.lowestBalanceMonth).toBe(0);
    expect(result.shortfallMonth).toBeNull();
    expect(result.points).toHaveLength(12);
  });

  it("flags the first month a structural deficit breaches the minimum", () => {
    const result = computeBalanceForecast({
      currency: "CHF",
      startingBalance: "1000",
      monthlyNetFlow: "-200",
      months: 6,
    });
    expect(result.shortfallMonth).toBe(6);
    expect(result.endingBalance).toBe("-200.0000");
    expect(result.lowestBalance).toBe("-200.0000");
    expect(result.lowestBalanceMonth).toBe(6);
  });

  it("applies one-off flows at the right month", () => {
    const result = computeBalanceForecast({
      currency: "CHF",
      startingBalance: "0",
      monthlyNetFlow: "0",
      months: 3,
      oneOffFlows: [{ month: 2, amount: "500" }],
    });
    expect(result.points[0].endingBalance).toBe("0.0000");
    expect(result.points[1].endingBalance).toBe("500.0000");
    expect(result.endingBalance).toBe("500.0000");
  });
});
