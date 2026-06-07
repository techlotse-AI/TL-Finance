import type {
  AccountType,
  CategoryKind,
  IncomeAllocationMethod,
  Recurrence,
} from "@prisma/client";

export function toDbRecurrence(value: string): Recurrence {
  return value.toUpperCase() as Recurrence;
}

export function fromDbRecurrence(value: Recurrence) {
  return value.toLowerCase() as
    | "once"
    | "weekly"
    | "monthly"
    | "quarterly"
    | "yearly"
    | "custom_months";
}

export function toDbCategoryKind(value: string): CategoryKind {
  return value.toUpperCase() as CategoryKind;
}

export function toDbAccountType(value: string): AccountType {
  return value.toUpperCase() as AccountType;
}

export function toDbAllocationMethod(value: string): IncomeAllocationMethod {
  return value.toUpperCase() as IncomeAllocationMethod;
}
