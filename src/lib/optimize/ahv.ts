import Decimal from "decimal.js";

import { money, serializeMoney } from "@/lib/money/decimal";

/**
 * Swiss Pillar 1 (AHV/AVS) old-age pension, scale 44.
 *
 * 2026 figures (unchanged from 2025): minimum full monthly pension CHF 1,260,
 * maximum CHF 2,520; full pension requires 44 contribution years and a
 * determining average annual income of at least CHF 90,720. A 13th monthly
 * pension is paid from 2026. The married-couple total is capped at 150% of the
 * maximum single pension (CHF 3,780/month).
 *
 * The full-pension amount follows the federal two-segment Rentenformel. With
 * minimum monthly pension m, minimum determining income = 12m, kink = 48m, and
 * maximum income = 72m:
 *   income <= 12m           -> m
 *   12m < income <= 48m     -> (13/600) * income + 0.74 * m
 *   48m < income <  72m     -> (11/1200) * income + 1.34 * m
 *   income >= 72m           -> 2m
 * The constants are derived from the federal anchor points and reproduce the
 * published Skala 44 values exactly (e.g. at the kink income, 1.78m).
 *
 * Sources: ahv-iv.ch (memento 3.01), koordination.ch Skala 44 (2025/2026),
 * invexa.ch, schwiizerfranke.com. Verified 2026-06.
 */
const PILLAR_1_PARAMS: Record<
  number,
  {
    minMonthly: number;
    maxMonthly: number;
    fullContributionYears: number;
    /** Age from which contribution years are counted (Jan 1 after turning 20). */
    contributionStartAge: number;
    /** Married-couple combined cap as a multiple of the maximum single pension. */
    coupleCapMultiple: number;
    /** Whether a 13th annual payment applies (from 2026). */
    thirteenthPension: boolean;
  }
> = {
  2025: {
    minMonthly: 1260,
    maxMonthly: 2520,
    fullContributionYears: 44,
    contributionStartAge: 21,
    coupleCapMultiple: 1.5,
    thirteenthPension: false,
  },
  2026: {
    minMonthly: 1260,
    maxMonthly: 2520,
    fullContributionYears: 44,
    contributionStartAge: 21,
    coupleCapMultiple: 1.5,
    thirteenthPension: true,
  },
};

const LATEST_YEAR = 2026;

export function ahvParams(year: number) {
  return PILLAR_1_PARAMS[year] ?? PILLAR_1_PARAMS[LATEST_YEAR];
}

/**
 * Full monthly pension (scale 44) for a determining average annual income,
 * before any contribution-gap reduction. Implements the federal two-segment
 * Rentenformel and clamps to the statutory minimum and maximum.
 */
export function fullMonthlyPension(year: number, determiningAverageAnnualIncome: string): Decimal {
  const params = ahvParams(year);
  const min = money(params.minMonthly);
  const max = money(params.maxMonthly);
  const income = money(determiningAverageAnnualIncome);

  const lower = min.times(12); // 12m
  const kink = min.times(48); // 48m
  const upper = min.times(72); // 72m

  if (income.lessThanOrEqualTo(lower)) return min;
  if (income.greaterThanOrEqualTo(upper)) return max;

  let pension: Decimal;
  if (income.lessThanOrEqualTo(kink)) {
    pension = income.times(13).dividedBy(600).plus(min.times("0.74"));
  } else {
    pension = income.times(11).dividedBy(1200).plus(min.times("1.34"));
  }
  return Decimal.min(Decimal.max(pension, min), max);
}

/**
 * Contribution years from a (possibly late) entry age to the reference age,
 * capped at the full-scale requirement. Late entry shortens the period and
 * therefore reduces the pension proportionally.
 */
export function contributionYearsFromAges(
  year: number,
  entryAge: number,
  referenceAge: number,
): { contributionYears: number; missingYears: number } {
  const params = ahvParams(year);
  const start = Math.max(entryAge, params.contributionStartAge);
  const raw = Math.max(0, referenceAge - start);
  const contributionYears = Math.min(raw, params.fullContributionYears);
  return {
    contributionYears,
    missingYears: params.fullContributionYears - contributionYears,
  };
}

export interface AhvPersonInput {
  year: number;
  /** Determining average annual income (after splitting/credits), in CHF. */
  determiningAverageAnnualIncome: string;
  /** Completed contribution years (use contributionYearsFromAges for late entry). */
  contributionYears: number;
}

export interface AhvPersonResult {
  year: number;
  scale: string;
  contributionYears: number;
  missingYears: number;
  partialFactorPercent: number;
  fullMonthlyPension: string;
  monthlyPension: string;
  annualPension: string;
  /** Annual total including the 13th payment where applicable. */
  annualPensionWithThirteenth: string;
  thirteenthPension: boolean;
}

/**
 * Individual AHV pension with proportional reduction for contribution gaps.
 * The partial factor approximates the official Rentenskala mapping as
 * contributionYears / 44, which is exact at the endpoints and a close linear
 * approximation between them.
 */
export function computeAhvPerson(input: AhvPersonInput): AhvPersonResult {
  const params = ahvParams(input.year);
  const full = fullMonthlyPension(input.year, input.determiningAverageAnnualIncome);
  const cappedYears = Math.min(Math.max(input.contributionYears, 0), params.fullContributionYears);
  const factor = new Decimal(cappedYears).dividedBy(params.fullContributionYears);
  const monthly = full.times(factor);
  const annual = monthly.times(12);
  const annualWith13 = params.thirteenthPension ? monthly.times(13) : annual;

  return {
    year: input.year,
    scale: `${cappedYears}/${params.fullContributionYears}`,
    contributionYears: cappedYears,
    missingYears: params.fullContributionYears - cappedYears,
    partialFactorPercent: Number(factor.times(100).toFixed(2)),
    fullMonthlyPension: serializeMoney(full),
    monthlyPension: serializeMoney(monthly),
    annualPension: serializeMoney(annual),
    annualPensionWithThirteenth: serializeMoney(annualWith13),
    thirteenthPension: params.thirteenthPension,
  };
}

export interface AhvCoupleResult {
  year: number;
  spouseA: AhvPersonResult;
  spouseB: AhvPersonResult;
  /** Monthly cap = coupleCapMultiple x maximum single pension. */
  monthlyCap: string;
  /** Sum of both monthly pensions before the cap. */
  combinedMonthlyBeforeCap: string;
  /** Sum after applying the 150% cap (proportional reduction if exceeded). */
  combinedMonthlyAfterCap: string;
  combinedAnnualAfterCap: string;
  combinedAnnualWithThirteenth: string;
  capApplied: boolean;
}

/**
 * Married-couple AHV: each spouse's pension is computed individually, then the
 * combined monthly total is capped at 150% of the maximum single pension. When
 * the cap binds, both pensions are scaled down proportionally. Determining
 * incomes are assumed to already reflect marital income splitting.
 */
export function computeAhvCouple(spouseA: AhvPersonInput, spouseB: AhvPersonInput): AhvCoupleResult {
  const year = spouseA.year;
  const params = ahvParams(year);
  const a = computeAhvPerson(spouseA);
  const b = computeAhvPerson(spouseB);

  const cap = money(params.maxMonthly).times(params.coupleCapMultiple);
  const combinedBefore = money(a.monthlyPension).plus(money(b.monthlyPension));
  const capApplied = combinedBefore.greaterThan(cap);
  const combinedAfter = capApplied ? cap : combinedBefore;
  const annualAfter = combinedAfter.times(12);
  const annualWith13 = params.thirteenthPension ? combinedAfter.times(13) : annualAfter;

  return {
    year,
    spouseA: a,
    spouseB: b,
    monthlyCap: serializeMoney(cap),
    combinedMonthlyBeforeCap: serializeMoney(combinedBefore),
    combinedMonthlyAfterCap: serializeMoney(combinedAfter),
    combinedAnnualAfterCap: serializeMoney(annualAfter),
    combinedAnnualWithThirteenth: serializeMoney(annualWith13),
    capApplied,
  };
}
