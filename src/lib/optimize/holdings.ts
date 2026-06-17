import Decimal from "decimal.js";

import { money, serializeMoney } from "@/lib/money/decimal";

export type AssetClass = "EQUITY" | "BOND" | "FUND" | "ETF" | "CASH" | "CRYPTO" | "OTHER";

export interface HoldingLotInput {
  /** Units acquired in this lot. May be fractional. */
  quantity: string;
  /** Cost per unit in the holding currency. */
  unitCost: string;
}

export interface HoldingInput {
  id?: string;
  name: string;
  symbol?: string | null;
  assetClass: AssetClass;
  currency: string;
  lots: HoldingLotInput[];
  /** Latest known unit price in the holding currency. */
  unitPrice: string;
}

export interface HoldingPosition {
  id?: string;
  name: string;
  symbol: string | null;
  assetClass: AssetClass;
  currency: string;
  quantity: string;
  unitPrice: string;
  costBasis: string;
  marketValue: string;
  unrealizedGain: string;
  unrealizedGainPercent: number | null;
}

/**
 * Deterministic single-position valuation in the holding's native currency.
 * Quantity sums every lot; cost basis sums quantity x unit cost per lot. No AI,
 * no live pricing: the caller supplies the latest unit price.
 */
export function computeHoldingPosition(input: HoldingInput): HoldingPosition {
  const unitPrice = money(input.unitPrice);
  let quantity = new Decimal(0);
  let costBasis = new Decimal(0);

  for (const lot of input.lots) {
    const lotQuantity = money(lot.quantity);
    quantity = quantity.plus(lotQuantity);
    costBasis = costBasis.plus(lotQuantity.times(money(lot.unitCost)));
  }

  const marketValue = quantity.times(unitPrice);
  const unrealizedGain = marketValue.minus(costBasis);
  const unrealizedGainPercent = costBasis.isZero()
    ? null
    : Number(unrealizedGain.dividedBy(costBasis).times(100).toFixed(2));

  return {
    id: input.id,
    name: input.name,
    symbol: input.symbol ?? null,
    assetClass: input.assetClass,
    currency: input.currency,
    quantity: quantity.toDecimalPlaces(6).toFixed(6),
    unitPrice: serializeMoney(unitPrice),
    costBasis: serializeMoney(costBasis),
    marketValue: serializeMoney(marketValue),
    unrealizedGain: serializeMoney(unrealizedGain),
    unrealizedGainPercent,
  };
}

export interface PortfolioAllocationSlice {
  key: string;
  value: string;
  percent: number;
}

export interface PortfolioResult {
  reportingCurrency: string;
  totalCostBasis: string;
  totalMarketValue: string;
  totalUnrealizedGain: string;
  totalUnrealizedGainPercent: number | null;
  byAssetClass: PortfolioAllocationSlice[];
  byCurrency: PortfolioAllocationSlice[];
  positions: Array<HoldingPosition & { reportingValue: string | null }>;
  /** Currencies that could not be converted because no rate was supplied. */
  missingRateCurrencies: string[];
}

export interface PortfolioOptions {
  reportingCurrency: string;
  /** Map of holding currency -> rate into the reporting currency. */
  rates: Record<string, string>;
}

/**
 * Aggregates positions into a portfolio in the reporting currency. Positions in
 * a currency without a supplied rate are excluded from totals and reported in
 * `missingRateCurrencies` so the UI can warn rather than mixing currencies.
 */
export function computePortfolio(
  positions: HoldingPosition[],
  options: PortfolioOptions,
): PortfolioResult {
  const reporting = options.reportingCurrency;
  const rateFor = (currency: string): Decimal | null => {
    if (currency === reporting) return new Decimal(1);
    const rate = options.rates[currency];
    return rate === undefined ? null : money(rate);
  };

  let totalCost = new Decimal(0);
  let totalValue = new Decimal(0);
  const assetClassTotals = new Map<string, Decimal>();
  const currencyTotals = new Map<string, Decimal>();
  const missing = new Set<string>();

  const enriched = positions.map((position) => {
    const rate = rateFor(position.currency);
    if (rate === null) {
      missing.add(position.currency);
      return { ...position, reportingValue: null };
    }
    const reportingValue = money(position.marketValue).times(rate);
    const reportingCost = money(position.costBasis).times(rate);
    totalValue = totalValue.plus(reportingValue);
    totalCost = totalCost.plus(reportingCost);
    assetClassTotals.set(
      position.assetClass,
      (assetClassTotals.get(position.assetClass) ?? new Decimal(0)).plus(reportingValue),
    );
    currencyTotals.set(
      position.currency,
      (currencyTotals.get(position.currency) ?? new Decimal(0)).plus(reportingValue),
    );
    return { ...position, reportingValue: serializeMoney(reportingValue) };
  });

  const toSlices = (totals: Map<string, Decimal>): PortfolioAllocationSlice[] =>
    [...totals.entries()]
      .map(([key, value]) => ({
        key,
        value: serializeMoney(value),
        percent: totalValue.isZero() ? 0 : Number(value.dividedBy(totalValue).times(100).toFixed(2)),
      }))
      .sort((left, right) => Number(money(right.value).minus(money(left.value))));

  const totalGain = totalValue.minus(totalCost);

  return {
    reportingCurrency: reporting,
    totalCostBasis: serializeMoney(totalCost),
    totalMarketValue: serializeMoney(totalValue),
    totalUnrealizedGain: serializeMoney(totalGain),
    totalUnrealizedGainPercent: totalCost.isZero()
      ? null
      : Number(totalGain.dividedBy(totalCost).times(100).toFixed(2)),
    byAssetClass: toSlices(assetClassTotals),
    byCurrency: toSlices(currencyTotals),
    positions: enriched,
    missingRateCurrencies: [...missing].sort(),
  };
}
