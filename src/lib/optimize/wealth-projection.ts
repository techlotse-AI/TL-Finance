import Decimal from "decimal.js";

import { money, serializeMoney, serializeRate } from "@/lib/money/decimal";

// Wealth projection with a contribution schedule (v0.9.1 wealth planner).
//
// All rates are REAL annual returns and all values are in today's purchasing
// power: salaries and expenses are assumed to grow with inflation (net effect
// zero), so no nominal-terms mode exists. Compounding is effective monthly via
// (1 + annual)^(1/12) − 1, matching projection.ts.
//
// Timing conventions (fixture-verified):
// - Recurring contributions and annual lump sums land at the END of a month.
// - One-time injections land at the START of a month and earn that month's
//   growth (e.g. property sale proceeds available from day one).
// - The initial balance counts as paid-in capital and compounds from month 1.
//
// TODO: add an optional Monte Carlo / sequence-of-returns mode in a later
// iteration; this engine is deterministic by design.

export interface ContributionScheduleInput {
  /** Level monthly contribution from month 1, applied at end of month. */
  baseMonthly: string;
  /** Absolute replacements of the monthly contribution from a given month. */
  steps?: Array<{ fromMonth: number; monthlyAmount: string }>;
  /** Recurring yearly lump sums when month ≡ monthOfYear (mod 12), end of month. */
  annualLumpSums?: Array<{ monthOfYear: number; amount: string }>;
  /** One-time injections at the start of the given month. */
  oneTimeInjections?: Array<{ month: number; amount: string }>;
}

export interface WealthProjectionInput {
  currency: string;
  currentAge: number;
  targetAge: number;
  initialBalance: string;
  schedule: ContributionScheduleInput;
  annualReturnRates: string[];
  /** Lever scenarios compared against the baseline at every rate. */
  levers?: Array<{
    name: string;
    initialBalance?: string;
    schedule?: ContributionScheduleInput;
  }>;
}

export interface WealthProjectionPoint {
  yearIndex: number;
  age: number;
  /** Everything paid in so far — initial balance, contributions, lumps, injections. */
  cumulativePayIns: string;
  /** endingBalance − cumulativePayIns: the portfolio's internal growth. */
  growth: string;
  endingBalance: string;
}

export interface WealthProjectionSeries {
  /** "baseline" or the lever name. */
  name: string;
  annualReturnRate: string;
  monthlyReturnRate: string;
  points: WealthProjectionPoint[];
  totalPayIns: string;
  totalGrowth: string;
  endingBalance: string;
  /** endingBalance − baseline endingBalance at the same rate; null on the baseline. */
  deltaVsBaselineAtHorizon: string | null;
  /**
   * First month where the portfolio's own monthly growth covers the recurring
   * contribution (balance × monthlyRate ≥ base/step contribution; lumps and
   * injections excluded). Null when the horizon never reaches it.
   */
  growthMatchesPayIn: { month: number; age: number; balance: string } | null;
}

export interface WealthProjectionResult {
  currency: string;
  currentAge: number;
  targetAge: number;
  horizonMonths: number;
  assumptions: {
    compounding: "effective_monthly";
    contributionTiming: "end_of_month";
    annualLumpTiming: "end_of_month";
    oneTimeInjectionTiming: "start_of_month";
    inflationHandling: "real_terms";
    includesTaxesAndFees: false;
  };
  /** Baseline first, then levers, repeated per annual return rate. */
  series: WealthProjectionSeries[];
}

export function projectWealth(input: WealthProjectionInput): WealthProjectionResult {
  const horizonMonths = (input.targetAge - input.currentAge) * 12;
  const series: WealthProjectionSeries[] = [];

  for (const annualReturnRate of input.annualReturnRates) {
    const baseline = projectSeries({
      name: "baseline",
      annualReturnRate,
      initialBalance: input.initialBalance,
      schedule: input.schedule,
      currentAge: input.currentAge,
      horizonMonths,
      baselineEndingBalance: null,
    });
    series.push(baseline);

    for (const lever of input.levers ?? []) {
      series.push(
        projectSeries({
          name: lever.name,
          annualReturnRate,
          initialBalance: lever.initialBalance ?? input.initialBalance,
          schedule: lever.schedule ?? input.schedule,
          currentAge: input.currentAge,
          horizonMonths,
          baselineEndingBalance: money(baseline.endingBalance),
        }),
      );
    }
  }

  return {
    currency: input.currency,
    currentAge: input.currentAge,
    targetAge: input.targetAge,
    horizonMonths,
    assumptions: {
      compounding: "effective_monthly",
      contributionTiming: "end_of_month",
      annualLumpTiming: "end_of_month",
      oneTimeInjectionTiming: "start_of_month",
      inflationHandling: "real_terms",
      includesTaxesAndFees: false,
    },
    series,
  };
}

function projectSeries({
  name,
  annualReturnRate,
  initialBalance,
  schedule,
  currentAge,
  horizonMonths,
  baselineEndingBalance,
}: {
  name: string;
  annualReturnRate: string;
  initialBalance: string;
  schedule: ContributionScheduleInput;
  currentAge: number;
  horizonMonths: number;
  baselineEndingBalance: Decimal | null;
}): WealthProjectionSeries {
  const annualRate = money(annualReturnRate);
  const monthlyRate = annualRate.plus(1).pow(new Decimal(1).dividedBy(12)).minus(1);
  const monthlyFactor = monthlyRate.plus(1);

  // Steps are absolute replacements; sort ascending so the latest step wins.
  const steps = [...(schedule.steps ?? [])].sort((a, b) => a.fromMonth - b.fromMonth);
  const lumps = (schedule.annualLumpSums ?? []).map((lump) => ({
    monthRemainder: lump.monthOfYear % 12,
    amount: money(lump.amount),
  }));
  const injectionsByMonth = new Map<number, Decimal>();
  for (const injection of schedule.oneTimeInjections ?? []) {
    const existing = injectionsByMonth.get(injection.month) ?? new Decimal(0);
    injectionsByMonth.set(injection.month, existing.plus(money(injection.amount)));
  }

  const baseMonthly = money(schedule.baseMonthly);
  const contributionAt = (month: number): Decimal => {
    let contribution = baseMonthly;
    for (const step of steps) {
      if (step.fromMonth <= month) contribution = money(step.monthlyAmount);
    }
    return contribution;
  };

  let balance = money(initialBalance);
  let payIns = money(initialBalance);
  const points: WealthProjectionPoint[] = [point(0, currentAge, payIns, balance)];
  let growthMatchesPayIn: WealthProjectionSeries["growthMatchesPayIn"] = null;

  for (let month = 1; month <= horizonMonths; month += 1) {
    const injection = injectionsByMonth.get(month);
    if (injection) {
      balance = balance.plus(injection);
      payIns = payIns.plus(injection);
    }

    const contribution = contributionAt(month);
    if (growthMatchesPayIn === null && balance.times(monthlyRate).greaterThanOrEqualTo(contribution)) {
      growthMatchesPayIn = {
        month,
        age: currentAge + month / 12,
        balance: serializeMoney(balance),
      };
    }

    balance = balance.times(monthlyFactor).plus(contribution);
    payIns = payIns.plus(contribution);

    for (const lump of lumps) {
      if (month % 12 === lump.monthRemainder) {
        balance = balance.plus(lump.amount);
        payIns = payIns.plus(lump.amount);
      }
    }

    if (month % 12 === 0) {
      points.push(point(month / 12, currentAge + month / 12, payIns, balance));
    }
  }

  return {
    name,
    annualReturnRate: serializeRate(annualRate),
    monthlyReturnRate: serializeRate(monthlyRate),
    points,
    totalPayIns: serializeMoney(payIns),
    totalGrowth: serializeMoney(balance.minus(payIns)),
    endingBalance: serializeMoney(balance),
    deltaVsBaselineAtHorizon: baselineEndingBalance
      ? serializeMoney(balance.minus(baselineEndingBalance))
      : null,
    growthMatchesPayIn,
  };
}

function point(
  yearIndex: number,
  age: number,
  cumulativePayIns: Decimal,
  endingBalance: Decimal,
): WealthProjectionPoint {
  return {
    yearIndex,
    age,
    cumulativePayIns: serializeMoney(cumulativePayIns),
    growth: serializeMoney(endingBalance.minus(cumulativePayIns)),
    endingBalance: serializeMoney(endingBalance),
  };
}
