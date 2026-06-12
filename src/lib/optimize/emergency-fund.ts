import { money, serializeMoney } from "@/lib/money/decimal";

export type EmergencyFundStatus = "funded" | "partial" | "unfunded";

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
}

export interface EmergencyFundResult {
  currency: string;
  essentialMonthly: string;
  targetMonths: number;
  targetAmount: string;
  currentReserve: string;
  gap: string;
  monthsCovered: number | null;
  fundedPercent: number | null;
  status: EmergencyFundStatus;
  suggestedMonthlyContribution: string;
}

/**
 * Deterministic emergency-fund calculation. Target = essential monthly spend x
 * target months of runway. The suggested monthly contribution closes any gap
 * over the chosen horizon. No forecasting, no AI.
 */
export function computeEmergencyFund(input: EmergencyFundInput): EmergencyFundResult {
  const essentialMonthly = money(input.essentialMonthly);
  const reserve = money(input.currentReserve);
  const target = essentialMonthly.times(input.targetMonths);
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
    targetMonths: input.targetMonths,
    targetAmount: serializeMoney(target),
    currentReserve: serializeMoney(reserve),
    gap: serializeMoney(positiveGap),
    monthsCovered,
    fundedPercent,
    status,
    suggestedMonthlyContribution: serializeMoney(positiveGap.dividedBy(closeOver)),
  };
}
