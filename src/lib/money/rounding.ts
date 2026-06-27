import Decimal from "decimal.js";

import { money, serializeMoney, type MoneyInput } from "@/lib/money/decimal";

/**
 * Whole-amount ("zero-cent") budget rounding and reconciliation tolerance.
 *
 * TL-Finance presents planned and reported amounts rounded to the nearest 5
 * currency units (e.g. CHF/$/€ 5). This is a *presentation and analysis* concern
 * only — stored money stays exact at Decimal(18,4) and the wire format is
 * unchanged. Use these helpers wherever a figure is shown to the user or fed
 * into budgeting analysis, never to mutate persisted values.
 */

/** Default rounding step: nearest 5 whole currency units. */
export const ROUNDING_STEP = 5;

/**
 * Reconciliation / adherence tolerance, in whole currency units. A planned vs.
 * actual (or any "should balance to zero") comparison only warns once it drifts
 * by more than this. Because the budget rounds to {@link ROUNDING_STEP}, a
 * residual of up to ±5 is rounding noise rather than a real discrepancy. This is
 * a zero-*dollar* (whole-unit), not zero-*cent*, balance check.
 */
export const RECONCILIATION_TOLERANCE = 5;

/** Rounds a money value to the nearest `step` units (half away from zero). */
export function roundToNearest(value: MoneyInput, step: number = ROUNDING_STEP): Decimal {
  if (!(step > 0)) {
    throw new Error("Rounding step must be a positive number.");
  }
  const parsed = money(value);
  const stepDecimal = new Decimal(step);
  return parsed.dividedBy(stepDecimal).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).times(stepDecimal);
}

/** Convenience: nearest {@link ROUNDING_STEP}, returned as a plain JS number for charts/totals. */
export function roundToNearest5(value: MoneyInput): number {
  return roundToNearest(value, ROUNDING_STEP).toNumber();
}

/** Serializes a money value rounded to the nearest step, as an exact 4-dp decimal string. */
export function serializeRounded(value: MoneyInput, step: number = ROUNDING_STEP): string {
  return serializeMoney(roundToNearest(value, step));
}

/** Formats a money value as a whole-unit, zero-cent currency string rounded to the nearest step. */
export function formatWhole(value: MoneyInput, currency: string, step: number = ROUNDING_STEP): string {
  return new Intl.NumberFormat("en-CH", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(roundToNearest(value, step).toNumber());
}

/**
 * True when `difference` is within the reconciliation tolerance of zero, i.e. it
 * is rounding noise rather than a real discrepancy. `tolerance` is in whole
 * currency units and defaults to {@link RECONCILIATION_TOLERANCE}.
 */
export function withinTolerance(
  difference: MoneyInput,
  tolerance: number = RECONCILIATION_TOLERANCE,
): boolean {
  return money(difference).abs().lessThanOrEqualTo(new Decimal(tolerance));
}
