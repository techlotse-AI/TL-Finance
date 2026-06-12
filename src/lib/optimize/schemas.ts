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

const fractionSchema = z
  .string()
  .trim()
  .refine((value) => {
    try {
      const rate = money(value);
      return rate.greaterThanOrEqualTo(0) && rate.lessThanOrEqualTo(1);
    } catch {
      return false;
    }
  }, "Rate must be a decimal fraction between 0 and 1.");

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

export const emergencyFundSchema = z.object({
  currentReserve: nonNegativeMoneySchema,
  targetMonths: z.number().int().min(1).max(24),
  closeOverMonths: z.number().int().min(1).max(120).optional(),
});

export type EmergencyFundRequest = z.infer<typeof emergencyFundSchema>;

export const pillar3aSchema = z
  .object({
    hasPensionFund: z.boolean(),
    netAnnualIncome: nonNegativeMoneySchema.optional(),
    contributedThisYear: nonNegativeMoneySchema,
    currentBalance: nonNegativeMoneySchema.optional(),
    marginalTaxRate: fractionSchema,
    yearsToRetirement: z.number().int().min(1).max(50),
    annualReturnRate: annualReturnRateSchema,
  })
  .superRefine((value, context) => {
    if (!value.hasPensionFund && value.netAnnualIncome === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Net annual income is required without a pension fund.",
        path: ["netAnnualIncome"],
      });
    }
  });

export type Pillar3aRequest = z.infer<typeof pillar3aSchema>;

export const recommendationsSchema = z.object({
  currentReserve: nonNegativeMoneySchema,
  targetMonths: z.number().int().min(1).max(24),
  hasPensionFund: z.boolean(),
  netAnnualIncome: nonNegativeMoneySchema.optional(),
  contributedThisYear: nonNegativeMoneySchema,
  marginalTaxRate: fractionSchema,
});

export type RecommendationsRequest = z.infer<typeof recommendationsSchema>;
