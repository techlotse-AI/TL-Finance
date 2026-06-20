import Decimal from "decimal.js";

import { money, serializeMoney } from "@/lib/money/decimal";

export type EmergencyFundStatus = "funded" | "partial" | "unfunded";

/**
 * Generic, country-agnostic description of guaranteed income that arrives after
 * a job/illness-driven loss of earnings. It deliberately holds no Swiss-specific
 * assumptions so other-country presets (see {@link swissUnemploymentProtection})
 * can map national rules onto the same deterministic engine.
 */
export interface IncomeProtection {
  /** Guaranteed monthly income while out of work (unemployment benefit, disability/illness cover, sick-pay), in the reporting currency. */
  monthlyBenefit: string;
  /** Elimination/waiting period, in months, before the benefit starts paying. */
  waitingPeriodMonths: number;
  /** Optional cap on how many months the benefit pays before it is exhausted. */
  benefitDurationMonths?: number;
  /** Optional cap on the benefit as a fraction (0..1) of essential spend it may offset. */
  coversPercentOfEssential?: string;
  /**
   * Months of continued full income before exposure begins — e.g. a notice
   * period worked on full pay, contractual severance, or 100% sick-pay
   * continuation. These months need no reserve and push the waiting window
   * later.
   */
  fullCoverageMonths?: number;
}

export interface EmergencyFundInput {
  currency: string;
  /** Recurrence-normalized monthly essential spending in the reporting currency. */
  essentialMonthly: string;
  /** Liquid reserves earmarked for emergencies. */
  currentReserve: string;
  /** Target months of runway (commonly 3-6). */
  targetMonths: number;
  /** Horizon, in months, over which to close any gap. */
  closeOverMonths?: number;
  /**
   * Optional income protection. Absent => today's behaviour (target =
   * essentialMonthly x targetMonths). Present => the required liquid runway is
   * reduced for the months the benefit covers part of essential spend.
   */
  incomeProtection?: IncomeProtection;
}

export interface EmergencyFundResult {
  currency: string;
  essentialMonthly: string;
  targetMonths: number;
  /** The amount to fund: the income-protection-adjusted target (equals the un-insured target when no protection is supplied). */
  targetAmount: string;
  currentReserve: string;
  gap: string;
  monthsCovered: number | null;
  fundedPercent: number | null;
  status: EmergencyFundStatus;
  suggestedMonthlyContribution: string;
  /** Whether income protection reduced the target below the un-insured amount. */
  incomeProtectionApplied: boolean;
  /** The classic target (essentialMonthly x targetMonths) before any protection. */
  unInsuredTargetAmount: string;
  /** How much income protection reduced the target (unInsuredTargetAmount - targetAmount), never negative. */
  protectionReduction: string;
  /** Inputs the protected target is derived from, so the reduction is explainable. */
  protectionBasis: string[];
  /** Human-readable sentence describing how protection changed the target, or null when none applied. */
  protectionExplanation: string | null;
}

/**
 * Deterministic emergency-fund calculation.
 *
 * Without income protection the target is the classic `essential monthly spend x
 * target months of runway`. With income protection the required liquid runway is
 * computed month by month over the target horizon:
 *
 *   1. `fullCoverageMonths` of continued income at the front need no reserve.
 *   2. The next `waitingPeriodMonths` need the full essential spend (benefit has
 *      not started).
 *   3. While the benefit pays (capped at `benefitDurationMonths` if given), each
 *      month needs only `max(essential - effective benefit, 0)`.
 *   4. Any months after the benefit is exhausted need the full essential again.
 *
 * The protected target can never exceed the un-insured target. The suggested
 * monthly contribution closes any gap over the chosen horizon. No forecasting,
 * no AI; every output is explainable.
 */
export function computeEmergencyFund(input: EmergencyFundInput): EmergencyFundResult {
  const essentialMonthly = money(input.essentialMonthly);
  const reserve = money(input.currentReserve);
  const months = input.targetMonths;
  const unInsuredTarget = essentialMonthly.times(months);

  const protection = input.incomeProtection;
  const target = protection ? protectedTarget(essentialMonthly, months, protection) : unInsuredTarget;

  const reduction = unInsuredTarget.minus(target);
  const protectionApplied = Boolean(protection) && reduction.greaterThan(0);

  const gap = target.minus(reserve);
  const positiveGap = gap.isPositive() ? gap : money(0);
  const closeOver = input.closeOverMonths && input.closeOverMonths > 0 ? input.closeOverMonths : 12;

  const monthsCovered = essentialMonthly.isZero() ? null : Number(reserve.dividedBy(essentialMonthly).toFixed(1));
  const fundedPercent = target.isZero() ? null : Number(reserve.dividedBy(target).times(100).toFixed(1));

  let status: EmergencyFundStatus;
  if (target.isZero() || reserve.greaterThanOrEqualTo(target)) status = "funded";
  else if (reserve.isPositive()) status = "partial";
  else status = "unfunded";

  return {
    currency: input.currency,
    essentialMonthly: serializeMoney(essentialMonthly),
    targetMonths: months,
    targetAmount: serializeMoney(target),
    currentReserve: serializeMoney(reserve),
    gap: serializeMoney(positiveGap),
    monthsCovered,
    fundedPercent,
    status,
    suggestedMonthlyContribution: serializeMoney(positiveGap.dividedBy(closeOver)),
    incomeProtectionApplied: protectionApplied,
    unInsuredTargetAmount: serializeMoney(unInsuredTarget),
    protectionReduction: serializeMoney(reduction.greaterThan(0) ? reduction : money(0)),
    protectionBasis: protection
      ? [
          "essentialMonthly",
          "targetMonths",
          "incomeProtection.monthlyBenefit",
          "incomeProtection.waitingPeriodMonths",
          ...(protection.benefitDurationMonths !== undefined ? ["incomeProtection.benefitDurationMonths"] : []),
          ...(protection.coversPercentOfEssential !== undefined ? ["incomeProtection.coversPercentOfEssential"] : []),
          ...(protection.fullCoverageMonths !== undefined ? ["incomeProtection.fullCoverageMonths"] : []),
        ]
      : [],
    protectionExplanation: protectionApplied
      ? buildExplanation(input.currency, essentialMonthly, protection!, reduction)
      : null,
  };
}

/**
 * Required liquid reserve over `months`, accounting for income protection.
 * Deterministic month-by-month allocation; the result is always <= the
 * un-insured target by construction.
 */
function protectedTarget(essential: Decimal, months: number, protection: IncomeProtection): Decimal {
  const fullCoverage = Math.max(0, Math.floor(protection.fullCoverageMonths ?? 0));
  const waiting = Math.max(0, Math.floor(protection.waitingPeriodMonths));
  const duration =
    protection.benefitDurationMonths !== undefined ? Math.max(0, Math.floor(protection.benefitDurationMonths)) : undefined;

  // Effective benefit can never offset more than essential spend, and respects
  // an optional explicit cap as a fraction of essential.
  const rawBenefit = money(protection.monthlyBenefit);
  const percentCap =
    protection.coversPercentOfEssential !== undefined ? essential.times(protection.coversPercentOfEssential) : essential;
  const effectiveBenefit = Decimal.min(rawBenefit, percentCap, essential);
  const reducedMonthlyNeed = Decimal.max(essential.minus(effectiveBenefit), money(0));

  let total = money(0);
  for (let i = 1; i <= months; i += 1) {
    if (i <= fullCoverage) continue; // covered by continued income
    const monthIntoUnemployment = i - fullCoverage;
    if (monthIntoUnemployment <= waiting) {
      total = total.plus(essential); // benefit not started yet
      continue;
    }
    const monthIntoBenefit = monthIntoUnemployment - waiting;
    if (duration !== undefined && monthIntoBenefit > duration) {
      total = total.plus(essential); // benefit exhausted
      continue;
    }
    total = total.plus(reducedMonthlyNeed);
  }
  return total;
}

function buildExplanation(currency: string, essential: Decimal, protection: IncomeProtection, reduction: Decimal): string {
  const parts: string[] = [];
  if (protection.fullCoverageMonths && protection.fullCoverageMonths > 0) {
    parts.push(`${protection.fullCoverageMonths} month(s) of continued income`);
  }
  parts.push(`a ${protection.monthlyBenefit} ${currency}/month benefit after a ${protection.waitingPeriodMonths}-month wait`);
  if (protection.benefitDurationMonths !== undefined) {
    parts.push(`paying for up to ${protection.benefitDurationMonths} months`);
  }
  const monthlyBenefit = money(protection.monthlyBenefit);
  const coverage = monthlyBenefit.greaterThanOrEqualTo(essential)
    ? "fully covering essential spending once it starts"
    : "covering part of essential spending once it starts";
  return `Income protection (${parts.join(", ")}, ${coverage}) reduces the required reserve by ${serializeMoney(
    reduction,
  )} ${currency}.`;
}

/**
 * Inputs to derive Swiss unemployment-insurance (ALV/AC) income protection.
 * The defaults reflect a private-sector employee laid off after the probation
 * period; every value can be overridden for a specific situation.
 */
export interface SwissUnemploymentInput {
  /** Gross monthly salary; the insured salary is this value capped at the ALV maximum. */
  monthlyGrossSalary: string;
  /**
   * Use the 80% replacement rate instead of 70%. It applies with dependent
   * children, from age 55, with a qualifying disability pension, or when the
   * insured monthly salary is at or below the low-income threshold.
   */
  higherRate?: boolean;
  /**
   * Months of notice worked on full pay (or guaranteed severance) before
   * unemployment begins. The Swiss statutory minimum after the first year of
   * service is 3 months; set to 0 for an abrupt loss with no notice. Default 3.
   */
  noticePeriodMonths?: number;
  /**
   * Months the daily allowance pays. Entitlement is set by the contribution
   * period: ~12 months (260 allowances), ~18 months (400), or 24 months (520,
   * the maximum). Default 24.
   */
  benefitDurationMonths?: number;
  /**
   * Months before the first payment lands (statutory waiting days plus
   * registration and processing). The brief is "payout starts max 60 days
   * after", so the default is 2.
   */
  waitingPeriodMonths?: number;
}

/**
 * Swiss unemployment-insurance (ALV/AC) parameters, verified 2026.
 *
 * The maximum insured salary is CHF 148,200/year (CHF 12,350/month). The
 * replacement rate is 70%, or 80% with dependent children, from age 55, with a
 * disability pension, or below the low-income threshold. The benefit pays up to
 * 520 daily allowances (~24 months) depending on the contribution period.
 *
 * Sources: arbeit.swiss (SECO-ALV), ahv-iv.ch, moneyland.ch. Verified 2026-06.
 */
export const SWISS_ALV_2026 = {
  maxInsuredMonthlySalary: 12350,
  standardRate: 0.7,
  higherRate: 0.8,
  maxBenefitMonths: 24,
  defaultNoticePeriodMonths: 3,
  defaultWaitingPeriodMonths: 2,
} as const;

/**
 * Build an {@link IncomeProtection} from Swiss ALV rules. This is the Swiss
 * country preset; the underlying emergency-fund engine stays country-agnostic so
 * other jurisdictions can supply their own preset or raw `IncomeProtection`.
 */
export function swissUnemploymentProtection(input: SwissUnemploymentInput): IncomeProtection {
  const insured = Decimal.min(money(input.monthlyGrossSalary), SWISS_ALV_2026.maxInsuredMonthlySalary);
  const rate = input.higherRate ? SWISS_ALV_2026.higherRate : SWISS_ALV_2026.standardRate;
  const monthlyBenefit = insured.times(rate);
  return {
    monthlyBenefit: serializeMoney(monthlyBenefit),
    waitingPeriodMonths: input.waitingPeriodMonths ?? SWISS_ALV_2026.defaultWaitingPeriodMonths,
    benefitDurationMonths: input.benefitDurationMonths ?? SWISS_ALV_2026.maxBenefitMonths,
    fullCoverageMonths: input.noticePeriodMonths ?? SWISS_ALV_2026.defaultNoticePeriodMonths,
  };
}
