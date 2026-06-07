import Decimal from "decimal.js";

import { money, serializeMoney } from "@/lib/money/decimal";

export const recurrenceValues = [
  "once",
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
  "custom_months",
] as const;

export type Recurrence = (typeof recurrenceValues)[number];

export interface MonthlyNormalizationInput {
  amount: Decimal.Value;
  recurrence: Recurrence;
  selectedMonths?: number[];
}

export interface MonthlyNormalizationResult {
  monthlyAmount: string;
  oneTimeAmount: string;
}

export function normalizeMonthly({
  amount,
  recurrence,
  selectedMonths = [],
}: MonthlyNormalizationInput): MonthlyNormalizationResult {
  const value = money(amount);

  if (value.isNegative()) {
    throw new Error("Planned amounts cannot be negative.");
  }

  if (recurrence === "custom_months") {
    validateSelectedMonths(selectedMonths);
  } else if (selectedMonths.length > 0) {
    throw new Error("Selected months are only valid for custom recurrence.");
  }

  let monthly = new Decimal(0);
  let oneTime = new Decimal(0);

  switch (recurrence) {
    case "once":
      oneTime = value;
      break;
    case "weekly":
      monthly = value.times(52).dividedBy(12);
      break;
    case "monthly":
      monthly = value;
      break;
    case "quarterly":
      monthly = value.dividedBy(3);
      break;
    case "yearly":
      monthly = value.dividedBy(12);
      break;
    case "custom_months":
      monthly = value.times(selectedMonths.length).dividedBy(12);
      break;
  }

  return {
    monthlyAmount: serializeMoney(monthly),
    oneTimeAmount: serializeMoney(oneTime),
  };
}

function validateSelectedMonths(months: number[]): void {
  if (months.length === 0) {
    throw new Error("Custom recurrence requires at least one selected month.");
  }

  if (new Set(months).size !== months.length) {
    throw new Error("Selected months must be unique.");
  }

  if (months.some((month) => !Number.isInteger(month) || month < 1 || month > 12)) {
    throw new Error("Selected months must be integers from 1 through 12.");
  }
}
