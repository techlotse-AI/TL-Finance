import Decimal from "decimal.js";

import { money } from "@/lib/money/decimal";

export type DeRiskInterpolationMode = "linear" | "step";

export interface DeRiskScheduleInput {
  startAge: number;
  startAnnualReturnRate: string;
  endAge: number;
  endAnnualReturnRate: string;
  interpolationMode: DeRiskInterpolationMode;
}

const ONE_TWELFTH = new Decimal(1).dividedBy(12);

export function monthlyRateFromAnnualRate(annualRate: Decimal): Decimal {
  return annualRate.plus(1).pow(ONE_TWELFTH).minus(1);
}

export function resolveAnnualReturnRateAtAge({
  age,
  fallbackAnnualReturnRate,
  deRiskSchedule,
}: {
  age: number;
  fallbackAnnualReturnRate: string;
  deRiskSchedule?: DeRiskScheduleInput;
}): Decimal {
  const fallback = money(fallbackAnnualReturnRate);
  if (!deRiskSchedule) {
    return fallback;
  }

  const startRate = money(deRiskSchedule.startAnnualReturnRate);
  const endRate = money(deRiskSchedule.endAnnualReturnRate);
  if (age < deRiskSchedule.startAge) {
    return fallback;
  }
  if (age >= deRiskSchedule.endAge) {
    return endRate;
  }
  if (deRiskSchedule.interpolationMode === "step") {
    return startRate;
  }

  const progress = new Decimal(age)
    .minus(deRiskSchedule.startAge)
    .dividedBy(deRiskSchedule.endAge - deRiskSchedule.startAge);
  return startRate.plus(endRate.minus(startRate).times(progress));
}

export function resolveMonthlyReturnRateAtAge({
  age,
  fallbackAnnualReturnRate,
  deRiskSchedule,
}: {
  age: number;
  fallbackAnnualReturnRate: string;
  deRiskSchedule?: DeRiskScheduleInput;
}): Decimal {
  return monthlyRateFromAnnualRate(
    resolveAnnualReturnRateAtAge({ age, fallbackAnnualReturnRate, deRiskSchedule }),
  );
}

export function minimumFutureAnnualReturnRate({
  startAge,
  fallbackAnnualReturnRate,
  deRiskSchedule,
}: {
  startAge: number;
  fallbackAnnualReturnRate: string;
  deRiskSchedule?: DeRiskScheduleInput;
}): Decimal {
  const fallback = money(fallbackAnnualReturnRate);
  if (!deRiskSchedule) {
    return fallback;
  }

  const endRate = money(deRiskSchedule.endAnnualReturnRate);
  if (startAge < deRiskSchedule.startAge) {
    return Decimal.min(fallback, endRate);
  }
  return endRate;
}
