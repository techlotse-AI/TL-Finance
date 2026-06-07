import { z } from "zod";

import { currencySchema, nameSchema } from "@/lib/budget/schemas";
import { money } from "@/lib/money/decimal";

const nonNegativeMoneySchema = z
  .string()
  .trim()
  .refine((value) => {
    try {
      return money(value).greaterThanOrEqualTo(0);
    } catch {
      return false;
    }
  }, "Amount must be a non-negative decimal value.");

const annualReturnRateSchema = z
  .string()
  .trim()
  .refine((value) => {
    try {
      const rate = money(value);
      return rate.greaterThan(-1) && rate.lessThanOrEqualTo(1);
    } catch {
      return false;
    }
  }, "Annual return must be greater than -1 and at most 1.");

export const projectionComparisonSchema = z
  .object({
    currency: currencySchema,
    startingAmount: nonNegativeMoneySchema,
    monthlyContribution: nonNegativeMoneySchema,
    years: z.number().int().min(1).max(60),
    scenarios: z
      .array(
        z.object({
          name: nameSchema.max(60),
          annualReturnRate: annualReturnRateSchema,
        }),
      )
      .min(1)
      .max(4),
  })
  .superRefine((value, context) => {
    const normalizedNames = value.scenarios.map((scenario) => scenario.name.toLowerCase());
    if (new Set(normalizedNames).size !== normalizedNames.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Scenario names must be unique.",
        path: ["scenarios"],
      });
    }
  });

export type ProjectionComparisonInput = z.infer<typeof projectionComparisonSchema>;
