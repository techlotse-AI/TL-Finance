import { z } from "zod";

import { recurrenceValues } from "@/lib/budget/recurrence";
import { money } from "@/lib/money/decimal";
import { supportedCurrencies } from "@/lib/money/currencies";

export const idSchema = z.string().min(1).max(64);
export const nameSchema = z.string().trim().min(1).max(120);
export const currencySchema = z
  .string()
  .trim()
  .length(3)
  .transform((value) => value.toUpperCase())
  .refine((value) => /^[A-Z]{3}$/.test(value), "Use a three-letter ISO currency code.");
export const positiveMoneySchema = z
  .string()
  .trim()
  .refine((value) => {
    try {
      return money(value).greaterThan(0);
    } catch {
      return false;
    }
  }, "Amount must be a positive decimal value.");
const recurrenceSchema = z.object({
  recurrence: z.enum(recurrenceValues),
  selectedMonths: z.array(z.number().int().min(1).max(12)).default([]),
});
const datedPlanSchema = recurrenceSchema.extend({
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullable().optional(),
});

export const accountSchema = z.object({
  name: nameSchema,
  type: z.enum([
    "personal",
    "savings",
    "investment",
    "retirement",
    "credit_card",
    "cash",
    "other",
  ]),
  institution: z.string().trim().max(120).nullable().optional(),
  maskedReference: z.string().trim().max(32).nullable().optional(),
});

export const accountCreateSchema = accountSchema.extend({
  supportedCurrencies: z
    .array(z.enum(supportedCurrencies))
    .min(1)
    .max(supportedCurrencies.length)
    .refine((currencies) => new Set(currencies).size === currencies.length, "Supported currencies must be unique."),
});

export const categoryGroupSchema = z.object({
  name: nameSchema,
  sortOrder: z.number().int().min(0).max(10000).default(0),
});

export const categorySchema = z.object({
  groupId: idSchema,
  name: nameSchema,
  kind: z.enum(["income", "expense", "saving", "investment", "retirement"]),
  essential: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(10000).default(0),
});

export const accountPocketSchema = z.object({
  accountId: idSchema,
  name: nameSchema,
  currency: currencySchema,
});

export const incomeSourceSchema = datedPlanSchema.extend({
  name: nameSchema,
  categoryId: idSchema,
  amount: positiveMoneySchema,
  currency: currencySchema,
});

export const incomeAllocationSchema = z
  .object({
    accountPocketId: idSchema,
    method: z.enum(["fixed", "percentage"]),
    fixedAmount: positiveMoneySchema.nullable().optional(),
    percentage: z
      .string()
      .trim()
      .nullable()
      .optional()
      .refine((value) => {
        if (value == null) {
          return true;
        }

        try {
          return money(value).greaterThan(0) && money(value).lessThanOrEqualTo(1);
        } catch {
          return false;
        }
      }, "Percentage must be a decimal fraction greater than zero and at most one."),
    sourceCurrency: currencySchema,
  })
  .superRefine((value, context) => {
    const hasFixed = value.fixedAmount != null;
    const hasPercentage = value.percentage != null;

    if (value.method === "fixed" && (!hasFixed || hasPercentage)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Fixed allocations require only fixedAmount.",
      });
    }

    if (value.method === "percentage" && (!hasPercentage || hasFixed)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Percentage allocations require only percentage.",
      });
    }
  });

export const incomeSourceWithAllocationsSchema = incomeSourceSchema.extend({
  allocations: z.array(incomeAllocationSchema).min(1),
});

export const plannedTransferSchema = datedPlanSchema
  .extend({
    name: nameSchema,
    fromAccountPocketId: idSchema,
    toAccountPocketId: idSchema,
    amount: positiveMoneySchema,
    currency: currencySchema,
  })
  .refine((value) => value.fromAccountPocketId !== value.toAccountPocketId, {
    message: "Source and destination pockets must differ.",
    path: ["toAccountPocketId"],
  });

export const budgetItemSchema = datedPlanSchema
  .extend({
    name: nameSchema,
    categoryId: idSchema,
    kind: z.enum(["expense", "saving", "investment", "retirement"]),
    amount: positiveMoneySchema,
    currency: currencySchema,
    paidFromAccountPocketId: idSchema.nullable().optional(),
    paidToAccountPocketId: idSchema.nullable().optional(),
    essential: z.boolean().default(false),
  })
  .superRefine((value, context) => {
    if (value.kind !== "expense") {
      if (!value.paidFromAccountPocketId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${value.kind} items require a funding pocket.`,
          path: ["paidFromAccountPocketId"],
        });
      }

      if (!value.paidToAccountPocketId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${value.kind} items require a destination pocket.`,
          path: ["paidToAccountPocketId"],
        });
      }
    }

    if (
      value.paidFromAccountPocketId &&
      value.paidFromAccountPocketId === value.paidToAccountPocketId
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Funding and destination pockets must differ.",
        path: ["paidToAccountPocketId"],
      });
    }
  });

export type BudgetItemInput = z.infer<typeof budgetItemSchema>;
