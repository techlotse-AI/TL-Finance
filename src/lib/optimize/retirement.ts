import Decimal from "decimal.js";

import { money, serializeMoney, serializeRate } from "@/lib/money/decimal";
import { serializeRealValue } from "@/lib/optimize/real-terms";

export type ReadinessStatus = "on_track" | "at_risk" | "shortfall";

export interface RetirementReadinessInput {
  currency: string;
  /** Either a target annual income, or a replacement ratio of current income. */
  targetAnnualIncome?: string;
  currentNetAnnualIncome?: string;
  /** Replacement ratio as a decimal fraction (0.8 = 80%) when no explicit target. */
  replacementRatio?: string;
  /** Guaranteed annual AHV (Pillar 1) income at retirement. */
  ahvAnnualIncome: string;
  /** Accumulated pension capital (Pillar 2/3a/3b) at retirement. */
  pensionCapitalAtRetirement: string;
  /** Other private investment capital at retirement. */
  investmentCapitalAtRetirement: string;
  /** Rate used to convert pension capital into annual income (e.g. 0.05). */
  pensionAnnuitizationRate: string;
  /** Sustainable withdrawal rate on private capital (e.g. 0.04). */
  investmentDrawdownRate: string;
  /** Expected years spent in retirement (for capital-gap sizing). */
  yearsInRetirement: number;
  /** Years until retirement (for the required-savings calculation). */
  yearsToRetirement: number;
  /** Assumed annual return while still saving (e.g. 0.03). */
  preRetirementReturnRate: string;
  /**
   * Optional assumed annual inflation rate (0.02 = 2%). When provided, the
   * projected income, gap, and additional capital needed are additionally
   * reported deflated to today's purchasing power over `yearsToRetirement`
   * (sprint 1, see `real-terms.ts`). `requiredMonthlySaving` is not deflated:
   * it is paid progressively in nominal terms between now and retirement,
   * not received as a single amount at a future date, so the same one-shot
   * discount does not apply to it.
   */
  assumedInflationRate?: string;
}

export interface RetirementReadinessResult {
  currency: string;
  targetAnnualIncome: string;
  ahvAnnualIncome: string;
  pensionAnnualIncome: string;
  investmentAnnualIncome: string;
  projectedAnnualIncome: string;
  annualGap: string;
  coveragePercent: number | null;
  status: ReadinessStatus;
  /** Extra capital needed at retirement to close the income gap. */
  additionalCapitalNeeded: string;
  /** Level monthly saving from now to retirement to reach that capital. */
  requiredMonthlySaving: string;
  /** `projectedAnnualIncome` in today's purchasing power; present only when `assumedInflationRate` was given. */
  realTermsProjectedAnnualIncome?: string;
  /** `annualGap` in today's purchasing power; present only when `assumedInflationRate` was given. */
  realTermsAnnualGap?: string;
  /** `additionalCapitalNeeded` in today's purchasing power; present only when `assumedInflationRate` was given. */
  realTermsAdditionalCapitalNeeded?: string;
  basis: string[];
  assumptions: {
    compounding: "annual_capital_monthly_saving";
    ignoresInflation: boolean;
    drawdown: "fixed_rate";
    /** The rate used for the realTerms* figures, echoed back; present only when it was given. */
    realTermsInflationRate?: string;
  };
}

/**
 * Deterministic retirement-readiness calculation. Projected income combines
 * guaranteed AHV income, annuitized pension capital, and a sustainable drawdown
 * on private investments. Any gap to the target is sized as the capital needed
 * to fund the gap over the retirement horizon, then converted to a level
 * monthly saving using an end-of-month annuity. Nominal by default; an
 * optional `assumedInflationRate` additionally reports the projected income,
 * gap, and additional capital in today's purchasing power (see
 * `real-terms.ts`). No AI.
 */
export function computeRetirementReadiness(
  input: RetirementReadinessInput,
): RetirementReadinessResult {
  const target = resolveTarget(input);

  const ahv = money(input.ahvAnnualIncome);
  const pensionIncome = money(input.pensionCapitalAtRetirement).times(money(input.pensionAnnuitizationRate));
  const investmentIncome = money(input.investmentCapitalAtRetirement).times(money(input.investmentDrawdownRate));
  const projected = ahv.plus(pensionIncome).plus(investmentIncome);

  const gap = target.minus(projected);
  const positiveGap = gap.isPositive() ? gap : new Decimal(0);
  const coveragePercent = target.isZero()
    ? null
    : Number(projected.dividedBy(target).times(100).toFixed(1));

  const additionalCapital = positiveGap.times(input.yearsInRetirement);
  const requiredMonthlySaving = monthlySavingForCapital(
    additionalCapital,
    input.preRetirementReturnRate,
    input.yearsToRetirement,
  );

  let status: ReadinessStatus;
  if (positiveGap.isZero()) status = "on_track";
  else if (coveragePercent !== null && coveragePercent >= 80) status = "at_risk";
  else status = "shortfall";

  const hasInflationAssumption = input.assumedInflationRate !== undefined;
  const yearsToRetirement = input.yearsToRetirement;

  return {
    currency: input.currency,
    targetAnnualIncome: serializeMoney(target),
    ahvAnnualIncome: serializeMoney(ahv),
    pensionAnnualIncome: serializeMoney(pensionIncome),
    investmentAnnualIncome: serializeMoney(investmentIncome),
    projectedAnnualIncome: serializeMoney(projected),
    annualGap: serializeMoney(positiveGap),
    coveragePercent,
    status,
    additionalCapitalNeeded: serializeMoney(additionalCapital),
    requiredMonthlySaving: serializeMoney(requiredMonthlySaving),
    ...(hasInflationAssumption
      ? {
          realTermsProjectedAnnualIncome: serializeRealValue(
            projected,
            yearsToRetirement,
            input.assumedInflationRate!,
          ),
          realTermsAnnualGap: serializeRealValue(positiveGap, yearsToRetirement, input.assumedInflationRate!),
          realTermsAdditionalCapitalNeeded: serializeRealValue(
            additionalCapital,
            yearsToRetirement,
            input.assumedInflationRate!,
          ),
        }
      : {}),
    basis: [
      "ahvAnnualIncome",
      "pensionCapitalAtRetirement",
      "investmentCapitalAtRetirement",
      "targetAnnualIncome",
    ],
    assumptions: {
      compounding: "annual_capital_monthly_saving",
      ignoresInflation: !hasInflationAssumption,
      drawdown: "fixed_rate",
      ...(hasInflationAssumption ? { realTermsInflationRate: serializeRate(input.assumedInflationRate!) } : {}),
    },
  };
}

function resolveTarget(input: RetirementReadinessInput): Decimal {
  if (input.targetAnnualIncome !== undefined) return money(input.targetAnnualIncome);
  if (input.currentNetAnnualIncome !== undefined && input.replacementRatio !== undefined) {
    return money(input.currentNetAnnualIncome).times(money(input.replacementRatio));
  }
  throw new Error("Provide targetAnnualIncome or currentNetAnnualIncome with replacementRatio.");
}

/**
 * Level monthly contribution to accumulate a target capital over the given
 * years, using effective-monthly compounding and end-of-month contributions:
 * PMT = FV * i / ((1+i)^n - 1).
 */
function monthlySavingForCapital(
  targetCapital: Decimal,
  annualReturnRate: string,
  years: number,
): Decimal {
  if (targetCapital.isZero() || years <= 0) return new Decimal(0);
  const annualRate = money(annualReturnRate);
  const monthlyRate = annualRate.plus(1).pow(new Decimal(1).dividedBy(12)).minus(1);
  const periods = years * 12;
  if (monthlyRate.isZero()) return targetCapital.dividedBy(periods);
  const growth = monthlyRate.plus(1).pow(periods).minus(1);
  return targetCapital.times(monthlyRate).dividedBy(growth);
}
