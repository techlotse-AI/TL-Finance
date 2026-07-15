import Decimal from "decimal.js";

import { money, serializeMoney } from "@/lib/money/decimal";

/**
 * Point-in-time net-worth statement (D4). Strictly Optimize: it aggregates
 * balance-bearing Optimize records (holdings market value, pension balances) and
 * account-derived cash balances as assets, minus debts and other liabilities, in
 * the household reporting currency. It is a reporting calculation only — it never
 * feeds the Budget money-flow and persists nothing.
 *
 * Every line is converted with a caller-supplied rate map (mirroring the
 * portfolio engine). A line whose currency has no rate is excluded from totals
 * and reported in `missingRateCurrencies` so the UI can warn rather than silently
 * mixing currencies. Net worth = total assets - total liabilities.
 */

export type NetWorthCategory =
  | "cash"
  | "investments"
  | "pension"
  | "other_asset"
  | "debt"
  | "other_liability";

/**
 * "Comfort threshold" (issue #53): 1/100th of 1% (0.0001) of net worth. Below
 * this amount, a price difference is financially negligible relative to total
 * wealth and isn't worth spending mental energy comparing — a "don't sweat it"
 * line that rises as net worth grows. Zero (never negative) when net worth is
 * negative or zero.
 */
export const COMFORT_THRESHOLD_RATE = 0.0001;

const LIABILITY_CATEGORIES: ReadonlySet<NetWorthCategory> = new Set<NetWorthCategory>([
  "debt",
  "other_liability",
]);

export function isLiabilityCategory(category: NetWorthCategory): boolean {
  return LIABILITY_CATEGORIES.has(category);
}

export interface NetWorthLineInput {
  label: string;
  category: NetWorthCategory;
  currency: string;
  /** Non-negative magnitude in the line's own currency. Sign is derived from the category. */
  amount: string;
}

export interface NetWorthInput {
  reportingCurrency: string;
  /** Map of line currency -> rate into the reporting currency. The reporting currency itself is implicitly 1. */
  rates: Record<string, string>;
  lines: NetWorthLineInput[];
}

export interface NetWorthLine extends NetWorthLineInput {
  isLiability: boolean;
  /** Converted value in the reporting currency, or null when no rate was available. */
  reportingValue: string | null;
  /** Whether this line was included in the totals. */
  included: boolean;
}

export interface NetWorthCategoryTotal {
  category: NetWorthCategory;
  isLiability: boolean;
  reportingValue: string;
  /** Share of the asset (or liability) side this category represents. */
  percentOfSide: number;
}

export interface NetWorthResult {
  reportingCurrency: string;
  totalAssets: string;
  totalLiabilities: string;
  netWorth: string;
  byCategory: NetWorthCategoryTotal[];
  lines: NetWorthLine[];
  /** Currencies excluded from totals because no rate was supplied. */
  missingRateCurrencies: string[];
  /** assets / liabilities, or null when there are no liabilities. */
  assetToLiabilityRatio: number | null;
  /** See {@link COMFORT_THRESHOLD_RATE}. */
  comfortThreshold: string;
}

export function computeNetWorth(input: NetWorthInput): NetWorthResult {
  const reporting = input.reportingCurrency;
  const rateFor = (currency: string): Decimal | null => {
    if (currency === reporting) return new Decimal(1);
    const rate = input.rates[currency];
    return rate === undefined ? null : money(rate);
  };

  let totalAssets = new Decimal(0);
  let totalLiabilities = new Decimal(0);
  const assetByCategory = new Map<NetWorthCategory, Decimal>();
  const liabilityByCategory = new Map<NetWorthCategory, Decimal>();
  const missing = new Set<string>();

  const lines: NetWorthLine[] = input.lines.map((line) => {
    const isLiability = isLiabilityCategory(line.category);
    const rate = rateFor(line.currency);
    if (rate === null) {
      missing.add(line.currency);
      return { ...line, isLiability, reportingValue: null, included: false };
    }
    const value = money(line.amount).times(rate);
    if (isLiability) {
      totalLiabilities = totalLiabilities.plus(value);
      liabilityByCategory.set(line.category, (liabilityByCategory.get(line.category) ?? new Decimal(0)).plus(value));
    } else {
      totalAssets = totalAssets.plus(value);
      assetByCategory.set(line.category, (assetByCategory.get(line.category) ?? new Decimal(0)).plus(value));
    }
    return { ...line, isLiability, reportingValue: serializeMoney(value), included: true };
  });

  const netWorth = totalAssets.minus(totalLiabilities);

  const toCategoryTotals = (
    totals: Map<NetWorthCategory, Decimal>,
    sideTotal: Decimal,
    isLiability: boolean,
  ): NetWorthCategoryTotal[] =>
    [...totals.entries()]
      .map(([category, value]) => ({
        category,
        isLiability,
        reportingValue: serializeMoney(value),
        percentOfSide: sideTotal.isZero() ? 0 : Number(value.dividedBy(sideTotal).times(100).toFixed(2)),
      }))
      .sort((left, right) => Number(money(right.reportingValue).minus(money(left.reportingValue))));

  const byCategory = [
    ...toCategoryTotals(assetByCategory, totalAssets, false),
    ...toCategoryTotals(liabilityByCategory, totalLiabilities, true),
  ];

  return {
    reportingCurrency: reporting,
    totalAssets: serializeMoney(totalAssets),
    totalLiabilities: serializeMoney(totalLiabilities),
    netWorth: serializeMoney(netWorth),
    byCategory,
    lines,
    missingRateCurrencies: [...missing].sort(),
    assetToLiabilityRatio: totalLiabilities.isZero()
      ? null
      : Number(totalAssets.dividedBy(totalLiabilities).toFixed(2)),
    comfortThreshold: serializeMoney(
      netWorth.isNegative() ? new Decimal(0) : netWorth.times(COMFORT_THRESHOLD_RATE),
    ),
  };
}
