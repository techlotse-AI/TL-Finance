import Decimal from "decimal.js";

import { money, serializeMoney } from "@/lib/money/decimal";

/**
 * Swiss Pillar 3a annual maximum deductible contribution, by year.
 *
 * 2026 figures (unchanged from 2025): CHF 7,258 with a 2nd-pillar pension fund;
 * otherwise 20% of net earned income up to CHF 36,288.
 * Sources: UBS, finpension, VIAC, Vermoegenszentrum (verified 2026-06).
 */
const PILLAR_3A_LIMITS: Record<number, { withPensionFund: number; selfEmployedRate: number; selfEmployedCap: number }> = {
  2025: { withPensionFund: 7258, selfEmployedRate: 0.2, selfEmployedCap: 36288 },
  2026: { withPensionFund: 7258, selfEmployedRate: 0.2, selfEmployedCap: 36288 },
};

const LATEST_YEAR = 2026;

export interface Pillar3aInput {
  currency: string;
  year: number;
  hasPensionFund: boolean;
  netAnnualIncome?: string;
  contributedThisYear: string;
  currentBalance?: string;
  /** Marginal income-tax rate as a decimal fraction (0.25 = 25%). */
  marginalTaxRate: string;
  yearsToRetirement: number;
  annualReturnRate: string;
}

export interface Pillar3aResult {
  currency: string;
  year: number;
  basis: "with_pension_fund" | "self_employed";
  maxContribution: string;
  contributedThisYear: string;
  remainingThisYear: string;
  annualTaxSavingAtMax: string;
  remainingTaxSaving: string;
  projection: {
    years: number;
    annualContribution: string;
    totalContributions: string;
    totalGrowth: string;
    endingBalance: string;
    totalTaxSaved: string;
  };
  assumptions: { contributionTiming: "end_of_year"; compounding: "annual"; ignoresInflation: true };
}

export function pillar3aMaxContribution(input: {
  year: number;
  hasPensionFund: boolean;
  netAnnualIncome?: string;
}): Decimal {
  const limits = PILLAR_3A_LIMITS[input.year] ?? PILLAR_3A_LIMITS[LATEST_YEAR];
  if (input.hasPensionFund) return money(limits.withPensionFund);
  const income = input.netAnnualIncome ? money(input.netAnnualIncome) : money(0);
  return Decimal.min(income.times(limits.selfEmployedRate), money(limits.selfEmployedCap));
}

export function computePillar3a(input: Pillar3aInput): Pillar3aResult {
  const max = pillar3aMaxContribution(input);
  const contributed = money(input.contributedThisYear);
  const remaining = Decimal.max(max.minus(contributed), money(0));
  const marginalRate = money(input.marginalTaxRate);

  const rate = money(input.annualReturnRate);
  const years = input.yearsToRetirement;
  const currentBalance = input.currentBalance ? money(input.currentBalance) : money(0);
  const annualContribution = max;

  // End-of-year annuity: FV = balance*(1+r)^n + C * (((1+r)^n - 1) / r).
  const growthFactor = rate.plus(1).pow(years);
  const annuityFactor = rate.isZero() ? new Decimal(years) : growthFactor.minus(1).dividedBy(rate);
  const endingBalance = currentBalance.times(growthFactor).plus(annualContribution.times(annuityFactor));
  const totalContributions = annualContribution.times(years);
  const totalGrowth = endingBalance.minus(currentBalance).minus(totalContributions);

  return {
    currency: input.currency,
    year: input.year,
    basis: input.hasPensionFund ? "with_pension_fund" : "self_employed",
    maxContribution: serializeMoney(max),
    contributedThisYear: serializeMoney(contributed),
    remainingThisYear: serializeMoney(remaining),
    annualTaxSavingAtMax: serializeMoney(max.times(marginalRate)),
    remainingTaxSaving: serializeMoney(remaining.times(marginalRate)),
    projection: {
      years,
      annualContribution: serializeMoney(annualContribution),
      totalContributions: serializeMoney(totalContributions),
      totalGrowth: serializeMoney(totalGrowth),
      endingBalance: serializeMoney(endingBalance),
      totalTaxSaved: serializeMoney(max.times(marginalRate).times(years)),
    },
    assumptions: { contributionTiming: "end_of_year", compounding: "annual", ignoresInflation: true },
  };
}
