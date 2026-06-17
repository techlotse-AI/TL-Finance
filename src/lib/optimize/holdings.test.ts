import { describe, expect, it } from "vitest";

import { computeHoldingPosition, computePortfolio } from "@/lib/optimize/holdings";

describe("computeHoldingPosition", () => {
  it("sums lots for quantity, cost basis, and unrealized gain", () => {
    const position = computeHoldingPosition({
      name: "Core equity ETF",
      symbol: "CSPX",
      assetClass: "ETF",
      currency: "CHF",
      unitPrice: "150",
      lots: [
        { quantity: "10", unitCost: "100" },
        { quantity: "5", unitCost: "120" },
      ],
    });

    expect(position.quantity).toBe("15.000000");
    expect(position.costBasis).toBe("1600.0000");
    expect(position.marketValue).toBe("2250.0000");
    expect(position.unrealizedGain).toBe("650.0000");
    expect(position.unrealizedGainPercent).toBe(40.62);
  });

  it("returns a null gain percent when there is no cost basis", () => {
    const position = computeHoldingPosition({
      name: "Gift shares",
      assetClass: "EQUITY",
      currency: "CHF",
      unitPrice: "10",
      lots: [{ quantity: "3", unitCost: "0" }],
    });
    expect(position.costBasis).toBe("0.0000");
    expect(position.unrealizedGainPercent).toBeNull();
  });
});

describe("computePortfolio", () => {
  const chf = computeHoldingPosition({
    name: "CHF ETF",
    assetClass: "ETF",
    currency: "CHF",
    unitPrice: "150",
    lots: [{ quantity: "15", unitCost: "100" }],
  });
  const usd = computeHoldingPosition({
    name: "USD fund",
    assetClass: "FUND",
    currency: "USD",
    unitPrice: "100",
    lots: [{ quantity: "10", unitCost: "80" }],
  });

  it("converts positions into the reporting currency and allocates", () => {
    const portfolio = computePortfolio([chf, usd], {
      reportingCurrency: "CHF",
      rates: { USD: "0.9" },
    });

    // CHF 2250 + USD 1000 * 0.9 = 900 -> 3150
    expect(portfolio.totalMarketValue).toBe("3150.0000");
    expect(portfolio.missingRateCurrencies).toEqual([]);
    const etf = portfolio.byAssetClass.find((slice) => slice.key === "ETF");
    expect(etf?.value).toBe("2250.0000");
    expect(etf?.percent).toBeCloseTo(71.43, 2);
  });

  it("excludes positions without a rate and reports them", () => {
    const portfolio = computePortfolio([chf, usd], {
      reportingCurrency: "CHF",
      rates: {},
    });
    expect(portfolio.totalMarketValue).toBe("2250.0000");
    expect(portfolio.missingRateCurrencies).toEqual(["USD"]);
  });
});
