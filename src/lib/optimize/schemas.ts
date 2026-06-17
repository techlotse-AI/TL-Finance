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

const signedMoneySchema = z
  .string()
  .trim()
  .refine((value) => {
    try {
      return money(value).isFinite();
    } catch {
      return false;
    }
  }, "Amount must be a finite decimal value.");

const positiveAmountSchema = z
  .string()
  .trim()
  .refine((value) => {
    try {
      return money(value).greaterThan(0);
    } catch {
      return false;
    }
  }, "Amount must be a positive decimal value.");

export const assetClassValues = ["EQUITY", "BOND", "FUND", "ETF", "CASH", "CRYPTO", "OTHER"] as const;
export const pensionPillarValues = ["PILLAR_2", "PILLAR_3A", "PILLAR_3B"] as const;

// --- v0.7.0 holdings ---

const holdingLotSchema = z.object({
  quantity: positiveAmountSchema,
  unitCost: nonNegativeMoneySchema,
  acquiredAt: z.coerce.date(),
});

export const holdingCreateSchema = z.object({
  name: nameSchema.max(120),
  symbol: z.string().trim().max(32).nullable().optional(),
  assetClass: z.enum(assetClassValues),
  currency: currencySchema,
  unitPrice: nonNegativeMoneySchema,
  accountId: z.string().min(1).max(64).nullable().optional(),
  lots: z.array(holdingLotSchema).min(1).max(200),
});

export type HoldingCreateRequest = z.infer<typeof holdingCreateSchema>;

export const holdingUpdateSchema = z
  .object({
    name: nameSchema.max(120).optional(),
    symbol: z.string().trim().max(32).nullable().optional(),
    unitPrice: nonNegativeMoneySchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field to update.");

export type HoldingUpdateRequest = z.infer<typeof holdingUpdateSchema>;

// --- v0.7.0 balance forecast ---

export const forecastSchema = z.object({
  startingBalance: signedMoneySchema,
  monthlyNetFlow: signedMoneySchema,
  months: z.number().int().min(1).max(120),
  minimumBalance: signedMoneySchema.optional(),
  oneOffFlows: z
    .array(z.object({ month: z.number().int().min(1).max(120), amount: signedMoneySchema }))
    .max(120)
    .optional(),
});

export type ForecastRequest = z.infer<typeof forecastSchema>;

// --- v0.7.0 persisted scenarios ---

export const scenarioPersistSchema = z.object({
  name: nameSchema.max(60),
  currency: currencySchema,
  startingAmount: nonNegativeMoneySchema,
  monthlyContribution: nonNegativeMoneySchema,
  years: z.number().int().min(1).max(60),
  scenarios: z
    .array(z.object({ name: nameSchema.max(60), annualReturnRate: annualReturnRateSchema }))
    .min(1)
    .max(4),
});

export type ScenarioPersistRequest = z.infer<typeof scenarioPersistSchema>;

// --- v0.7.5 pensions, Pillar 1, retirement ---

const ahvPersonSchema = z.object({
  determiningAverageAnnualIncome: nonNegativeMoneySchema,
  contributionYears: z.number().int().min(0).max(50).optional(),
  entryAge: z.number().int().min(15).max(70).optional(),
  referenceAge: z.number().int().min(58).max(70).default(65),
});

export const ahvSchema = z
  .object({
    person: ahvPersonSchema,
    spouse: ahvPersonSchema.optional(),
  })
  .superRefine((value, context) => {
    const people: Array<[string, z.infer<typeof ahvPersonSchema> | undefined]> = [
      ["person", value.person],
      ["spouse", value.spouse],
    ];
    for (const [key, person] of people) {
      if (!person) continue;
      if (person.contributionYears === undefined && person.entryAge === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Provide contributionYears or entryAge.",
          path: [key],
        });
      }
    }
  });

export type AhvRequest = z.infer<typeof ahvSchema>;

export const pensionVehicleCreateSchema = z.object({
  label: nameSchema.max(120),
  pillar: z.enum(pensionPillarValues),
  currency: currencySchema,
  currentBalance: nonNegativeMoneySchema,
  annualContribution: nonNegativeMoneySchema,
  annualReturnRate: annualReturnRateSchema,
  yearsToRetirement: z.number().int().min(0).max(50),
});

export type PensionVehicleCreateRequest = z.infer<typeof pensionVehicleCreateSchema>;

export const retirementSchema = z
  .object({
    targetAnnualIncome: nonNegativeMoneySchema.optional(),
    currentNetAnnualIncome: nonNegativeMoneySchema.optional(),
    replacementRatio: fractionSchema.optional(),
    ahvAnnualIncome: nonNegativeMoneySchema,
    pensionCapitalAtRetirement: nonNegativeMoneySchema,
    investmentCapitalAtRetirement: nonNegativeMoneySchema,
    pensionAnnuitizationRate: fractionSchema,
    investmentDrawdownRate: fractionSchema,
    yearsInRetirement: z.number().int().min(1).max(50),
    yearsToRetirement: z.number().int().min(0).max(50),
    preRetirementReturnRate: annualReturnRateSchema,
  })
  .superRefine((value, context) => {
    if (
      value.targetAnnualIncome === undefined &&
      (value.currentNetAnnualIncome === undefined || value.replacementRatio === undefined)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide targetAnnualIncome, or currentNetAnnualIncome with replacementRatio.",
        path: ["targetAnnualIncome"],
      });
    }
  });

export type RetirementRequest = z.infer<typeof retirementSchema>;
