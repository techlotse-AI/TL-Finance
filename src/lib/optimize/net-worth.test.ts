import { describe, expect, it } from "vitest";

import { computeNetWorth, isLiabilityCategory } from "@/lib/optimize/net-worth";

describe("isLiabilityCategory", () => {
  it("classifies debt and other_liability as liabilities", () => {
    expect(isLiabilityCategory("debt")).toBe(true);
    expect(isLiabilityCategory("other_liability")).toBe(true);
    expect(isLiabilityCategory("cash")).toBe(false);
    expect(isLiabilityCategory("investments")).toBe(false);
    expect(isLiabilityCategory("pension")).toBe(false);
    expect(isLiabilityCategory("other_asset")).toBe(false);
  });
});

describe("computeNetWorth — single currency", () => {
  it("sums assets, subtracts liabilities, and breaks down by category", () => {
    const result = computeNetWorth({
      reportingCurrency: "CHF",
      rates: {},
      lines: [
        { label: "Checking", category: "cash", currency: "CHF", amount: "10000" },
        { label: "Portfolio", category: "investments", currency: "CHF", amount: "50000" },
        { label: "Pillar 2", category: "pension", currency: "CHF", amount: "120000" },
        { label: "Mortgage", category: "debt", currency: "CHF", amount: "300000" },
        { label: "Credit card", category: "debt", currency: "CHF", amount: "5000" },
      ],
    });
    expect(result.totalAssets).toBe("180000.0000");
    expect(result.totalLiabilities).toBe("305000.0000");
    expect(result.netWorth).toBe("-125000.0000");
    expect(result.assetToLiabilityRatio).toBe(0.59);

    const debt = result.byCategory.find((c) => c.category === "debt")!;
    expect(debt.isLiability).toBe(true);
    expect(debt.reportingValue).toBe("305000.0000");
    expect(debt.percentOfSide).toBe(100);

    const pension = result.byCategory.find((c) => c.category === "pension")!;
    expect(pension.percentOfSide).toBe(Number((120000 / 180000 * 100).toFixed(2)));
  });

  it("reports a null ratio when there are no liabilities", () => {
    const result = computeNetWorth({
      reportingCurrency: "CHF",
      rates: {},
      lines: [{ label: "Cash", category: "cash", currency: "CHF", amount: "5000" }],
    });
    expect(result.totalLiabilities).toBe("0.0000");
    expect(result.netWorth).toBe("5000.0000");
    expect(result.assetToLiabilityRatio).toBeNull();
  });
});

describe("computeNetWorth — multi-currency", () => {
  it("converts each line via the rate map", () => {
    const result = computeNetWorth({
      reportingCurrency: "CHF",
      rates: { EUR: "0.95", USD: "0.90" },
      lines: [
        { label: "CHF cash", category: "cash", currency: "CHF", amount: "1000" },
        { label: "EUR fund", category: "investments", currency: "EUR", amount: "2000" }, // 1900 CHF
        { label: "USD loan", category: "debt", currency: "USD", amount: "1000" }, // 900 CHF
      ],
    });
    expect(result.totalAssets).toBe("2900.0000"); // 1000 + 1900
    expect(result.totalLiabilities).toBe("900.0000");
    expect(result.netWorth).toBe("2000.0000");
  });

  it("excludes lines with no rate and reports the currency", () => {
    const result = computeNetWorth({
      reportingCurrency: "CHF",
      rates: {},
      lines: [
        { label: "CHF cash", category: "cash", currency: "CHF", amount: "1000" },
        { label: "GBP account", category: "cash", currency: "GBP", amount: "5000" },
      ],
    });
    expect(result.totalAssets).toBe("1000.0000");
    expect(result.missingRateCurrencies).toEqual(["GBP"]);
    const excluded = result.lines.find((line) => line.currency === "GBP")!;
    expect(excluded.included).toBe(false);
    expect(excluded.reportingValue).toBeNull();
  });
});
