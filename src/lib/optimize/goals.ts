import Decimal from "decimal.js";

import { money, serializeMoney } from "@/lib/money/decimal";
import { roundToNearest, ROUNDING_STEP } from "@/lib/money/rounding";

/**
 * Financial goals / sinking funds (Phase D, D2). Deterministic and explainable:
 * for each goal it computes how much remains, the monthly contribution required
 * to reach the target by the target date, progress, and an on-track / behind /
 * ahead status against the saver's current planned monthly contribution. Every
 * output cites its inputs in `basis[]`, exactly like the other Optimize tools.
 *
 * Strictly Optimize and balance-free with respect to Budget: it reports on saved
 * amounts the saver enters (or that are linked from an account), and never feeds
 * the Budget money-flow. It persists nothing; the route loads persisted goals and
 * passes them through here.
 *
 * Money is exact Decimal end to end. Amounts are *also* surfaced rounded to the
 * nearest {@link ROUNDING_STEP} units for the whole-amount ("zero-cent") budget
 * UI; the required monthly contribution is rounded **up** to the step so a
 * rounded plan never undershoots the target.
 */

export type GoalStatus =
  | "reached" // current saved >= target
  | "no_target_date" // open-ended goal, no date to pace against
  | "ahead" // planned monthly comfortably exceeds required
  | "on_track" // planned monthly within tolerance of required
  | "behind" // planned monthly below required
  | "unreachable"; // no months left and not yet reached

export interface GoalInput {
  /** Stable identifier (e.g. the persisted row id); echoed back for the UI. */
  id?: string;
  name: string;
  currency: string;
  /** Target amount in the goal's own currency. */
  targetAmount: string;
  /** Amount already saved toward the goal, in the goal's own currency. */
  currentAmount: string;
  /**
   * Whole months remaining until the target date, as computed by the caller via
   * {@link monthsUntil}. `null` means the goal is open-ended (no target date).
   */
  monthsRemaining: number | null;
  /** The saver's current planned monthly contribution, if any. */
  plannedMonthlyContribution?: string;
}

export interface GoalResult {
  id?: string;
  name: string;
  currency: string;
  targetAmount: string;
  currentAmount: string;
  /** target - current, floored at zero. */
  remainingAmount: string;
  monthsRemaining: number | null;
  /** Exact monthly contribution needed to reach the target by the target date. */
  requiredMonthlyContribution: string | null;
  /** {@link requiredMonthlyContribution} rounded UP to the nearest step (never undershoots). */
  requiredMonthlyContributionRounded: string | null;
  plannedMonthlyContribution: string | null;
  /** planned - required; positive is a surplus, negative a shortfall. null when no date. */
  monthlyShortfall: string | null;
  /** 0..100, current / target. */
  progressPercent: number;
  status: GoalStatus;
  /**
   * Months to reach the target at the *planned* contribution rate (ignores the
   * target date). null when there is no planned contribution or none is needed.
   */
  monthsAtPlannedRate: number | null;
  basis: string[];
}

export interface GoalsInput {
  reportingCurrency: string;
  /** Map of goal currency -> rate into the reporting currency. Reporting currency is implicitly 1. */
  rates: Record<string, string>;
  goals: GoalInput[];
  /**
   * Tolerance (in the goal's currency units) within which a planned contribution
   * counts as "on track" rather than behind/ahead. Defaults to the budget's
   * reconciliation tolerance.
   */
  toleranceUnits?: number;
}

export interface GoalsSummary {
  reportingCurrency: string;
  goalCount: number;
  /** Sum of targets converted to the reporting currency (excludes missing-rate goals). */
  totalTarget: string;
  totalSaved: string;
  totalRemaining: string;
  /** Sum of required monthly contributions across dated, unreached goals, reporting currency. */
  totalRequiredMonthly: string;
  /** Overall saved / target as a percentage. */
  overallProgressPercent: number;
  /** Currencies excluded from the reporting-currency totals because no rate was supplied. */
  missingRateCurrencies: string[];
}

export interface GoalsResult {
  goals: GoalResult[];
  summary: GoalsSummary;
}

/**
 * Whole months from `from` to `to`, never negative. Counts complete months: if
 * `to`'s day-of-month has not yet been reached relative to `from`, the partial
 * month is not counted. Deterministic and timezone-agnostic (uses UTC parts).
 */
export function monthsUntil(from: Date, to: Date): number {
  let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) {
    months -= 1;
  }
  return Math.max(0, months);
}

/** Rounds a value UP to the next multiple of `step` (ceiling), so a plan never undershoots. */
function ceilToStep(value: Decimal, step: number): Decimal {
  const stepDecimal = new Decimal(step);
  return value.dividedBy(stepDecimal).toDecimalPlaces(0, Decimal.ROUND_CEIL).times(stepDecimal);
}

function computeGoal(goal: GoalInput, toleranceUnits: number): GoalResult {
  const target = money(goal.targetAmount);
  const current = money(goal.currentAmount);
  const remaining = Decimal.max(target.minus(current), new Decimal(0));
  const planned = goal.plannedMonthlyContribution !== undefined ? money(goal.plannedMonthlyContribution) : null;

  const progressPercent = target.isZero()
    ? (current.greaterThanOrEqualTo(0) ? 100 : 0)
    : Number(Decimal.min(current.dividedBy(target).times(100), new Decimal(100)).toDecimalPlaces(2));

  const basis: string[] = [
    `Target ${serializeMoney(target)} ${goal.currency}; saved ${serializeMoney(current)} ${goal.currency}.`,
  ];

  // Already reached.
  if (remaining.isZero()) {
    basis.push("Goal reached: saved amount meets or exceeds the target.");
    return {
      id: goal.id,
      name: goal.name,
      currency: goal.currency,
      targetAmount: serializeMoney(target),
      currentAmount: serializeMoney(current),
      remainingAmount: "0.0000",
      monthsRemaining: goal.monthsRemaining,
      requiredMonthlyContribution: "0.0000",
      requiredMonthlyContributionRounded: "0.0000",
      plannedMonthlyContribution: planned ? serializeMoney(planned) : null,
      monthlyShortfall: null,
      progressPercent,
      status: "reached",
      monthsAtPlannedRate: 0,
      basis,
    };
  }

  basis.push(`Remaining to save: ${serializeMoney(remaining)} ${goal.currency}.`);

  // Months to reach the target at the planned rate, independent of any deadline.
  let monthsAtPlannedRate: number | null = null;
  if (planned && planned.greaterThan(0)) {
    monthsAtPlannedRate = Number(remaining.dividedBy(planned).toDecimalPlaces(0, Decimal.ROUND_CEIL));
  }

  // Open-ended goal: no date to pace against.
  if (goal.monthsRemaining === null) {
    if (monthsAtPlannedRate !== null) {
      basis.push(`At the planned ${serializeMoney(planned!)} ${goal.currency}/month, reached in ~${monthsAtPlannedRate} months.`);
    } else {
      basis.push("No target date and no planned contribution set; open-ended goal.");
    }
    return {
      id: goal.id,
      name: goal.name,
      currency: goal.currency,
      targetAmount: serializeMoney(target),
      currentAmount: serializeMoney(current),
      remainingAmount: serializeMoney(remaining),
      monthsRemaining: null,
      requiredMonthlyContribution: null,
      requiredMonthlyContributionRounded: null,
      plannedMonthlyContribution: planned ? serializeMoney(planned) : null,
      monthlyShortfall: null,
      progressPercent,
      status: "no_target_date",
      monthsAtPlannedRate,
      basis,
    };
  }

  // Dated goal but no months left and not reached: unreachable on time.
  if (goal.monthsRemaining <= 0) {
    basis.push("Target date has passed and the goal is not yet reached; pay the remaining amount now or extend the date.");
    return {
      id: goal.id,
      name: goal.name,
      currency: goal.currency,
      targetAmount: serializeMoney(target),
      currentAmount: serializeMoney(current),
      remainingAmount: serializeMoney(remaining),
      monthsRemaining: 0,
      requiredMonthlyContribution: serializeMoney(remaining),
      requiredMonthlyContributionRounded: serializeMoney(ceilToStep(remaining, ROUNDING_STEP)),
      plannedMonthlyContribution: planned ? serializeMoney(planned) : null,
      monthlyShortfall: planned ? serializeMoney(planned.minus(remaining)) : serializeMoney(remaining.negated()),
      progressPercent,
      status: "unreachable",
      monthsAtPlannedRate,
      basis,
    };
  }

  // Dated goal with time remaining: required = remaining / months.
  const required = remaining.dividedBy(new Decimal(goal.monthsRemaining));
  const requiredRounded = ceilToStep(required, ROUNDING_STEP);
  basis.push(
    `${serializeMoney(remaining)} over ${goal.monthsRemaining} months = ${serializeMoney(required)} ${goal.currency}/month required (rounded up to ${serializeMoney(requiredRounded)}).`,
  );

  let status: GoalStatus;
  let monthlyShortfall: Decimal | null = null;
  if (planned) {
    monthlyShortfall = planned.minus(required);
    const tolerance = new Decimal(toleranceUnits);
    if (monthlyShortfall.abs().lessThanOrEqualTo(tolerance)) {
      status = "on_track";
      basis.push(`Planned ${serializeMoney(planned)} is within ±${toleranceUnits} of the required amount: on track.`);
    } else if (monthlyShortfall.greaterThan(0)) {
      status = "ahead";
      basis.push(`Planned ${serializeMoney(planned)} exceeds the required amount by ${serializeMoney(monthlyShortfall)}: ahead of schedule.`);
    } else {
      status = "behind";
      basis.push(`Planned ${serializeMoney(planned)} is ${serializeMoney(monthlyShortfall.negated())} short of the required amount: behind.`);
    }
  } else {
    status = "behind";
    monthlyShortfall = required.negated();
    basis.push("No planned contribution set; set one at least equal to the required amount.");
  }

  return {
    id: goal.id,
    name: goal.name,
    currency: goal.currency,
    targetAmount: serializeMoney(target),
    currentAmount: serializeMoney(current),
    remainingAmount: serializeMoney(remaining),
    monthsRemaining: goal.monthsRemaining,
    requiredMonthlyContribution: serializeMoney(required),
    requiredMonthlyContributionRounded: serializeMoney(requiredRounded),
    plannedMonthlyContribution: planned ? serializeMoney(planned) : null,
    monthlyShortfall: monthlyShortfall ? serializeMoney(monthlyShortfall) : null,
    progressPercent,
    status,
    monthsAtPlannedRate,
    basis,
  };
}

export function computeGoals(input: GoalsInput): GoalsResult {
  const tolerance = input.toleranceUnits ?? 5;
  const reporting = input.reportingCurrency;
  const rateFor = (currency: string): Decimal | null => {
    if (currency === reporting) return new Decimal(1);
    const rate = input.rates[currency];
    return rate === undefined ? null : money(rate);
  };

  const goals = input.goals.map((goal) => computeGoal(goal, tolerance));

  let totalTarget = new Decimal(0);
  let totalSaved = new Decimal(0);
  let totalRemaining = new Decimal(0);
  let totalRequiredMonthly = new Decimal(0);
  const missing = new Set<string>();

  for (const goal of goals) {
    const rate = rateFor(goal.currency);
    if (rate === null) {
      missing.add(goal.currency);
      continue;
    }
    totalTarget = totalTarget.plus(money(goal.targetAmount).times(rate));
    totalSaved = totalSaved.plus(money(goal.currentAmount).times(rate));
    totalRemaining = totalRemaining.plus(money(goal.remainingAmount).times(rate));
    if (goal.requiredMonthlyContribution !== null && goal.monthsRemaining !== null && goal.monthsRemaining > 0) {
      totalRequiredMonthly = totalRequiredMonthly.plus(money(goal.requiredMonthlyContribution).times(rate));
    }
  }

  const overallProgressPercent = totalTarget.isZero()
    ? 0
    : Number(Decimal.min(totalSaved.dividedBy(totalTarget).times(100), new Decimal(100)).toDecimalPlaces(2));

  return {
    goals,
    summary: {
      reportingCurrency: reporting,
      goalCount: goals.length,
      totalTarget: serializeMoney(totalTarget),
      totalSaved: serializeMoney(totalSaved),
      totalRemaining: serializeMoney(totalRemaining),
      totalRequiredMonthly: serializeMoney(totalRequiredMonthly),
      overallProgressPercent,
      missingRateCurrencies: [...missing].sort(),
    },
  };
}
