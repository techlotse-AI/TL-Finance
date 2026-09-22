import Decimal from "decimal.js";

import { money, serializeMoney } from "@/lib/money/decimal";

/**
 * Real-terms (inflation-adjusted) conversion, shared across the Optimize
 * calculators that project a nominal amount forward to a future date.
 *
 * `wealth-projection.ts` and `drawdown.ts` already assume every input return
 * rate is REAL (see their module doc comments): salaries and expenses are
 * assumed to grow with inflation at the same pace, so those two engines have
 * no nominal mode and need no toggle. Pillar 3a and pension-vehicle capital
 * projections, and the retirement-readiness calculator, instead compute in
 * nominal terms by default (their `assumptions.ignoresInflation` flag), since
 * that matches what a statement or plan usually quotes. This module lets
 * those calculators additionally report a figure in today's purchasing
 * power, as an explicit opt-in (sprint 1, 2026-09-25 — see
 * docs/strategy/ROADMAP.md), without changing their nominal default.
 *
 * The deflator is a plain constant-rate compounding discount:
 * real = nominal / (1 + inflationRate)^years. It is deliberately the same
 * shape as compound growth run backwards, so it composes with each
 * calculator's own compounding without introducing a second convention.
 */
export function toRealValue(
  nominalAmount: Decimal.Value,
  years: number,
  annualInflationRate: Decimal.Value,
): Decimal {
  const nominal = money(nominalAmount);
  if (years <= 0) return nominal;
  const deflator = money(annualInflationRate).plus(1).pow(years);
  return nominal.dividedBy(deflator);
}

/** Same as {@link toRealValue}, serialized to the standard money string format. */
export function serializeRealValue(
  nominalAmount: Decimal.Value,
  years: number,
  annualInflationRate: Decimal.Value,
): string {
  return serializeMoney(toRealValue(nominalAmount, years, annualInflationRate));
}
