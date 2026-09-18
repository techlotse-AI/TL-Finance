import Decimal from "decimal.js";

import type { DeRiskScheduleInput } from "@/lib/optimize/de-risk";
import {
  minimumFutureAnnualReturnRate,
  monthlyRateFromAnnualRate,
  resolveAnnualReturnRateAtAge,
  resolveMonthlyReturnRateAtAge,
} from "@/lib/optimize/de-risk";
import { money, serializeMoney, serializeRate } from "@/lib/money/decimal";

// Retirement drawdown planner (v0.9.1 wealth planner).
//
// All rates are REAL annual returns and all values are in today's purchasing
// power. Compounding is effective monthly via (1 + annual)^(1/12) − 1 and
// withdrawals land at the END of a month, matching the wealth projection.
//
// Modes per return rate:
// - Fixed-horizon annuity: PMT = V·i / (1 − (1+i)^−n) depletes exactly at the
//   target age (zero-rate branch: PMT = V/n).
// - Endowment: PMT = V·i draws growth only; capital is never touched.
// - Fixed expense: given a monthly draw PMT, the depletion horizon is
//   n = −ln(1 − V·i/PMT) / ln(1+i), or unlimited when V·i ≥ PMT
//   (zero-rate branch: n = V/PMT).
//
// Depletion ages beyond FOREVER_DISPLAY_CAP_AGE are truthfully reported (the
// engine never fabricates "forever"); presentation may render them as
// "effectively forever". This matters: a draw slightly above V·i still
// depletes eventually — e.g. drawing 10'929/mo from 2'640'574 at 5% real
// (V·i ≈ 10'758) runs out around age 150, not never.

export const FOREVER_DISPLAY_CAP_AGE = 120;

export interface DrawdownInput {
  currency: string;
  startingCapital: string;
  startAge: number;
  annualReturnRates: string[];
  deRiskSchedule?: DeRiskScheduleInput;
  depleteAtAges: number[];
  /** Fixed-expense mode: monthly draw whose depletion age is computed. */
  monthlyExpense?: string;
}

export interface DrawdownCurvePoint {
  age: number;
  balance: string;
}

export interface DrawdownCurve {
  mode: "endowment" | `deplete_${number}` | "fixed_expense";
  label: string;
  monthlyDraw: string;
  points: DrawdownCurvePoint[];
}

export interface DrawdownRateResult {
  annualReturnRate: string;
  monthlyReturnRate: string;
  /** PMT = V·i — capital preserved indefinitely. */
  endowmentMonthlyDraw: string;
  /** Fixed-horizon annuity draws, one per target depletion age. */
  depleteBy: Array<{ targetAge: number; months: number; monthlyDraw: string }>;
  /** Present only when the input carries a monthlyExpense. */
  fixedExpense: {
    monthlyExpense: string;
    /** V·i ≥ PMT: the draw never depletes the capital. */
    sustainable: boolean;
    depletionMonths: number | null;
    depletionAge: number | null;
  } | null;
  /** Yearly balance curves per mode for the chart. */
  curves: DrawdownCurve[];
}

export interface DrawdownResult {
  currency: string;
  startAge: number;
  startingCapital: string;
  assumptions: {
    compounding: "effective_monthly";
    withdrawalTiming: "end_of_month";
    inflationHandling: "real_terms";
    foreverDisplayCapAge: typeof FOREVER_DISPLAY_CAP_AGE;
  };
  byRate: DrawdownRateResult[];
}

export function computeDrawdown(input: DrawdownInput): DrawdownResult {
  const capital = money(input.startingCapital);

  return {
    currency: input.currency,
    startAge: input.startAge,
    startingCapital: serializeMoney(capital),
    assumptions: {
      compounding: "effective_monthly",
      withdrawalTiming: "end_of_month",
      inflationHandling: "real_terms",
      foreverDisplayCapAge: FOREVER_DISPLAY_CAP_AGE,
    },
    byRate: input.annualReturnRates.map((annualReturnRate) =>
      computeRate({
        annualReturnRate,
        capital,
        startAge: input.startAge,
        depleteAtAges: input.depleteAtAges,
        deRiskSchedule: input.deRiskSchedule,
        monthlyExpense: input.monthlyExpense,
      }),
    ),
  };
}

function computeRate({
  annualReturnRate,
  capital,
  startAge,
  depleteAtAges,
  deRiskSchedule,
  monthlyExpense,
}: {
  annualReturnRate: string;
  capital: Decimal;
  startAge: number;
  depleteAtAges: number[];
  deRiskSchedule?: DeRiskScheduleInput;
  monthlyExpense?: string;
}): DrawdownRateResult {
  const annualRate = money(annualReturnRate);
  const monthlyRate = resolveMonthlyReturnRateAtAge({
    age: startAge,
    fallbackAnnualReturnRate: annualReturnRate,
    deRiskSchedule,
  });
  const endowmentAnnualRate = minimumFutureAnnualReturnRate({
    startAge,
    fallbackAnnualReturnRate: annualReturnRate,
    deRiskSchedule,
  });
  const endowmentMonthlyRate = monthlyRateFromAnnualRate(endowmentAnnualRate);
  const monthlyGrowth = capital.times(endowmentMonthlyRate);

  const depleteBy = depleteAtAges.map((targetAge) => {
    const months = (targetAge - startAge) * 12;
    return {
      targetAge,
      months,
      monthlyDraw: serializeMoney(
        deRiskSchedule
          ? solveFixedHorizonDraw({
              capital,
              annualReturnRate,
              deRiskSchedule,
              startAge,
              months,
            })
          : annuityDraw(capital, monthlyRate, months),
      ),
    };
  });

  let fixedExpense: DrawdownRateResult["fixedExpense"] = null;
  if (monthlyExpense !== undefined) {
    const draw = money(monthlyExpense);
    const { sustainable, depletionMonths } = deRiskSchedule
      ? computeFixedExpenseWithSchedule({
          capital,
          annualReturnRate,
          deRiskSchedule,
          startAge,
          monthlyDraw: draw,
        })
      : computeFixedExpenseConstantRate({ capital, monthlyRate, draw });
    fixedExpense = {
      monthlyExpense: serializeMoney(draw),
      sustainable,
      depletionMonths,
      depletionAge: depletionMonths === null ? null : startAge + depletionMonths / 12,
    };
  }

  const curves: DrawdownCurve[] = [
    {
      mode: "endowment",
      label: "Endowment (capital preserved)",
      monthlyDraw: serializeMoney(monthlyGrowth),
      points: simulateCurve({
        capital,
        annualReturnRate,
        deRiskSchedule,
        monthlyDraw: monthlyGrowth,
        startAge,
        endAge: FOREVER_DISPLAY_CAP_AGE,
      }),
    },
    ...depleteBy.map((entry) => ({
      mode: `deplete_${entry.targetAge}` as const,
      label: `Deplete by ${entry.targetAge}`,
      monthlyDraw: entry.monthlyDraw,
      points: simulateCurve({
        capital,
        annualReturnRate,
        deRiskSchedule,
        monthlyDraw: money(entry.monthlyDraw),
        startAge,
        endAge: entry.targetAge,
      }),
    })),
  ];
  if (fixedExpense) {
    curves.push({
      mode: "fixed_expense",
      label: `Fixed expense ${fixedExpense.monthlyExpense}/mo`,
      monthlyDraw: fixedExpense.monthlyExpense,
      points: simulateCurve({
        capital,
        annualReturnRate,
        deRiskSchedule,
        monthlyDraw: money(fixedExpense.monthlyExpense),
        startAge,
        endAge: FOREVER_DISPLAY_CAP_AGE,
      }),
    });
  }

  return {
    annualReturnRate: serializeRate(annualRate),
    monthlyReturnRate: serializeRate(monthlyRate),
    endowmentMonthlyDraw: serializeMoney(monthlyGrowth),
    depleteBy,
    fixedExpense,
    curves,
  };
}

/** Fixed-horizon annuity: PMT = V·i / (1 − (1+i)^−n); zero-rate branch V/n. */
function annuityDraw(capital: Decimal, monthlyRate: Decimal, months: number): Decimal {
  if (monthlyRate.isZero()) {
    return capital.dividedBy(months);
  }
  const discount = money(1).minus(monthlyRate.plus(1).pow(-months));
  return capital.times(monthlyRate).dividedBy(discount);
}

function computeFixedExpenseConstantRate({
  capital,
  monthlyRate,
  draw,
}: {
  capital: Decimal;
  monthlyRate: Decimal;
  draw: Decimal;
}): { sustainable: boolean; depletionMonths: number | null } {
  const monthlyGrowth = capital.times(monthlyRate);
  const sustainable = monthlyGrowth.greaterThanOrEqualTo(draw);
  if (sustainable) {
    return { sustainable, depletionMonths: null };
  }
  if (monthlyRate.isZero()) {
    return { sustainable, depletionMonths: capital.dividedBy(draw).toNumber() };
  }
  return {
    sustainable,
    depletionMonths: money(1)
      .minus(monthlyGrowth.dividedBy(draw))
      .ln()
      .negated()
      .dividedBy(monthlyRate.plus(1).ln())
      .toNumber(),
  };
}

function computeFixedExpenseWithSchedule({
  capital,
  annualReturnRate,
  deRiskSchedule,
  startAge,
  monthlyDraw,
}: {
  capital: Decimal;
  annualReturnRate: string;
  deRiskSchedule: DeRiskScheduleInput;
  startAge: number;
  monthlyDraw: Decimal;
}): { sustainable: boolean; depletionMonths: number | null } {
  const transitionAge = Math.max(startAge, deRiskSchedule.endAge);
  const transitionMonths = (transitionAge - startAge) * 12;
  const transition = simulateBalance({
    capital,
    annualReturnRate,
    deRiskSchedule,
    monthlyDraw,
    startAge,
    months: transitionMonths,
  });
  if (transition.depletedMonth !== null) {
    return { sustainable: false, depletionMonths: transition.depletedMonth };
  }

  const postTransitionAnnualRate = resolveAnnualReturnRateAtAge({
    age: transitionAge,
    fallbackAnnualReturnRate: annualReturnRate,
    deRiskSchedule,
  });
  const postTransitionMonthlyRate = monthlyRateFromAnnualRate(postTransitionAnnualRate);
  const postTransition = computeFixedExpenseConstantRate({
    capital: transition.endingBalance,
    monthlyRate: postTransitionMonthlyRate,
    draw: monthlyDraw,
  });
  if (postTransition.sustainable) {
    return postTransition;
  }
  return {
    sustainable: false,
    depletionMonths: transitionMonths + postTransition.depletionMonths!,
  };
}

function solveFixedHorizonDraw({
  capital,
  annualReturnRate,
  deRiskSchedule,
  startAge,
  months,
}: {
  capital: Decimal;
  annualReturnRate: string;
  deRiskSchedule: DeRiskScheduleInput;
  startAge: number;
  months: number;
}): Decimal {
  let growthFactor = new Decimal(1);
  let withdrawalWeight = new Decimal(0);

  for (let month = 1; month <= months; month += 1) {
    const monthlyRate = resolveMonthlyReturnRateAtAge({
      age: startAge + (month - 1) / 12,
      fallbackAnnualReturnRate: annualReturnRate,
      deRiskSchedule,
    });
    const monthlyFactor = monthlyRate.plus(1);
    growthFactor = growthFactor.times(monthlyFactor);
    withdrawalWeight = withdrawalWeight.times(monthlyFactor).plus(1);
  }

  return capital.times(growthFactor).dividedBy(withdrawalWeight);
}

/**
 * Simulate the balance month by month (growth, then end-of-month draw) and
 * sample yearly. Stops at the cap age or when the capital runs out, whichever
 * comes first; a depleted curve ends on an explicit zero point.
 */
function simulateCurve(
  {
    capital,
    annualReturnRate,
    deRiskSchedule,
    monthlyDraw,
    startAge,
    endAge,
  }: {
    capital: Decimal;
    annualReturnRate: string;
    deRiskSchedule?: DeRiskScheduleInput;
    monthlyDraw: Decimal;
    startAge: number;
    endAge: number;
  },
): DrawdownCurvePoint[] {
  const horizonMonths = (Math.min(endAge, FOREVER_DISPLAY_CAP_AGE) - startAge) * 12;
  let balance = capital;
  const points: DrawdownCurvePoint[] = [{ age: startAge, balance: serializeMoney(balance) }];

  for (let month = 1; month <= horizonMonths; month += 1) {
    const monthlyRate = resolveMonthlyReturnRateAtAge({
      age: startAge + (month - 1) / 12,
      fallbackAnnualReturnRate: annualReturnRate,
      deRiskSchedule,
    });
    balance = balance.times(monthlyRate.plus(1)).minus(monthlyDraw);
    if (balance.lessThanOrEqualTo(0)) {
      points.push({ age: startAge + month / 12, balance: serializeMoney(0) });
      return points;
    }
    if (month % 12 === 0) {
      points.push({ age: startAge + month / 12, balance: serializeMoney(balance) });
    }
  }

  return points;
}

function simulateBalance({
  capital,
  annualReturnRate,
  deRiskSchedule,
  monthlyDraw,
  startAge,
  months,
}: {
  capital: Decimal;
  annualReturnRate: string;
  deRiskSchedule?: DeRiskScheduleInput;
  monthlyDraw: Decimal;
  startAge: number;
  months: number;
}): { endingBalance: Decimal; depletedMonth: number | null } {
  let balance = capital;
  for (let month = 1; month <= months; month += 1) {
    const monthlyRate = resolveMonthlyReturnRateAtAge({
      age: startAge + (month - 1) / 12,
      fallbackAnnualReturnRate: annualReturnRate,
      deRiskSchedule,
    });
    balance = balance.times(monthlyRate.plus(1)).minus(monthlyDraw);
    if (balance.lessThanOrEqualTo(0)) {
      return { endingBalance: balance, depletedMonth: month };
    }
  }
  return { endingBalance: balance, depletedMonth: null };
}
