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

// --- v0.9.0 D1: income-protection-aware emergency fund ---

/** Generic, country-agnostic income protection (raw inputs to the engine). */
export const incomeProtectionSchema = z.object({
  monthlyBenefit: nonNegativeMoneySchema,
  waitingPeriodMonths: z.number().int().min(0).max(24),
  benefitDurationMonths: z.number().int().min(0).max(120).optional(),
  coversPercentOfEssential: fractionSchema.optional(),
  fullCoverageMonths: z.number().int().min(0).max(24).optional(),
});

/** Swiss ALV/AC preset inputs; the route derives an IncomeProtection from these. */
export const swissUnemploymentSchema = z.object({
  monthlyGrossSalary: nonNegativeMoneySchema,
  higherRate: z.boolean().optional(),
  noticePeriodMonths: z.number().int().min(0).max(24).optional(),
  benefitDurationMonths: z.number().int().min(0).max(120).optional(),
  waitingPeriodMonths: z.number().int().min(0).max(24).optional(),
});

export const emergencyFundSchema = z
  .object({
    currentReserve: nonNegativeMoneySchema,
    targetMonths: z.number().int().min(1).max(24),
    closeOverMonths: z.number().int().min(1).max(120).optional(),
    incomeProtection: incomeProtectionSchema.optional(),
    swissUnemployment: swissUnemploymentSchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.incomeProtection && value.swissUnemployment) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either incomeProtection or swissUnemployment, not both.",
        path: ["incomeProtection"],
      });
    }
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

export const recommendationsSchema = z
  .object({
    currentReserve: nonNegativeMoneySchema,
    targetMonths: z.number().int().min(1).max(24),
    hasPensionFund: z.boolean(),
    netAnnualIncome: nonNegativeMoneySchema.optional(),
    contributedThisYear: nonNegativeMoneySchema,
    marginalTaxRate: fractionSchema,
    incomeProtection: incomeProtectionSchema.optional(),
    swissUnemployment: swissUnemploymentSchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.incomeProtection && value.swissUnemployment) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either incomeProtection or swissUnemployment, not both.",
        path: ["incomeProtection"],
      });
    }
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
  // Optional provider-stated Pillar 2 (BVG) projection from the member's statement.
  projectedCapitalOverride: nonNegativeMoneySchema.optional(),
  projectedAnnualPensionOverride: nonNegativeMoneySchema.optional(),
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


// --- v0.9.0 D3: debt payoff calculator ---

const debtItemSchema = z.object({
  name: nameSchema.max(120),
  balance: nonNegativeMoneySchema,
  annualInterestRate: fractionSchema,
  minimumPayment: nonNegativeMoneySchema,
});

export const debtPayoffSchema = z.object({
  currency: currencySchema,
  strategy: z.enum(["avalanche", "snowball"]).optional(),
  extraMonthlyPayment: nonNegativeMoneySchema.optional(),
  maxMonths: z.number().int().min(1).max(1200).optional(),
  debts: z.array(debtItemSchema).min(1).max(50),
});

export type DebtPayoffRequest = z.infer<typeof debtPayoffSchema>;


// --- v0.8.3 D4: net-worth statement ---

const netWorthDebtSchema = z.object({
  name: nameSchema.max(120),
  balance: nonNegativeMoneySchema,
  currency: currencySchema,
});

const netWorthManualLineSchema = z.object({
  label: nameSchema.max(120),
  amount: nonNegativeMoneySchema,
  currency: currencySchema,
});

export const netWorthSchema = z.object({
  debts: z.array(netWorthDebtSchema).max(50).optional(),
  additionalAssets: z.array(netWorthManualLineSchema).max(50).optional(),
  additionalLiabilities: z.array(netWorthManualLineSchema).max(50).optional(),
});

export type NetWorthRequest = z.infer<typeof netWorthSchema>;


// --- v0.9.0 D2: financial goals / sinking funds ---

export const goalCreateSchema = z.object({
  name: nameSchema.max(120),
  currency: currencySchema,
  targetAmount: positiveAmountSchema,
  currentAmount: nonNegativeMoneySchema.optional(),
  // Target date as an ISO date string (YYYY-MM-DD); null/omitted = open-ended.
  targetDate: z.coerce.date().nullable().optional(),
  plannedMonthlyContribution: nonNegativeMoneySchema.nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export type GoalCreateRequest = z.infer<typeof goalCreateSchema>;

export const goalUpdateSchema = z
  .object({
    name: nameSchema.max(120).optional(),
    targetAmount: positiveAmountSchema.optional(),
    currentAmount: nonNegativeMoneySchema.optional(),
    targetDate: z.coerce.date().nullable().optional(),
    plannedMonthlyContribution: nonNegativeMoneySchema.nullable().optional(),
    notes: z.string().trim().max(500).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field to update.");

export type GoalUpdateRequest = z.infer<typeof goalUpdateSchema>;


// --- v0.9.1: cashflow & wealth planner ---

/**
 * Contribution schedule for the wealth projection. Month numbering starts at 1
 * (the first projected month). Timing conventions (see wealth-projection.ts):
 * recurring contributions and annual lump sums land at the END of a month,
 * one-time injections at the START of a month (they earn that month's growth).
 */
export const contributionScheduleSchema = z.object({
  /** Level monthly contribution from month 1, applied at end of month. */
  baseMonthly: nonNegativeMoneySchema,
  /** Absolute replacements of the monthly contribution from a given month (not deltas). */
  steps: z
    .array(
      z.object({
        fromMonth: z.number().int().min(1).max(1200),
        monthlyAmount: nonNegativeMoneySchema,
      }),
    )
    .max(20)
    .default([]),
  /** Recurring yearly lump sums, applied end-of-month when month ≡ monthOfYear (mod 12). */
  annualLumpSums: z
    .array(
      z.object({
        monthOfYear: z.number().int().min(1).max(12),
        amount: nonNegativeMoneySchema,
      }),
    )
    .max(12)
    .default([]),
  /** One-time injections at the start of the given month (e.g. property sale proceeds). */
  oneTimeInjections: z
    .array(
      z.object({
        month: z.number().int().min(1).max(1200),
        amount: nonNegativeMoneySchema,
      }),
    )
    .max(50)
    .default([]),
});

export type ContributionScheduleRequest = z.infer<typeof contributionScheduleSchema>;

/**
 * The shared wealth-plan configuration (persisted as `WealthPlan.config` Json,
 * `version: 1`). One config drives both the wealth-projection and drawdown
 * views. All rates are REAL annual returns and all values are in today's
 * purchasing power — salaries and expenses are assumed to grow with inflation
 * (net effect zero), so no nominal-terms mode exists.
 */
export const wealthPlanConfigSchema = z
  .object({
    version: z.literal(1),
    currentAge: z.number().int().min(18).max(100),
    targetRetirementAge: z.number().int().min(30).max(100).default(65),
    initialBalance: nonNegativeMoneySchema,
    schedule: contributionScheduleSchema,
    /** Real annual return rates for the projection chart (e.g. 0.04/0.05/0.07). */
    projectionRates: z.array(annualReturnRateSchema).min(1).max(6),
    drawdown: z.object({
      annualReturnRates: z.array(annualReturnRateSchema).min(1).max(6),
      depleteAtAges: z.array(z.number().int().min(41).max(120)).min(1).max(4),
      /** Fixed-expense mode: monthly draw whose depletion age is computed. */
      monthlyExpense: positiveAmountSchema.optional(),
    }),
  })
  .superRefine((value, context) => {
    if (value.targetRetirementAge <= value.currentAge) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Target retirement age must be greater than the current age.",
        path: ["targetRetirementAge"],
      });
    }
    for (const [index, age] of value.drawdown.depleteAtAges.entries()) {
      if (age <= value.targetRetirementAge) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Depletion ages must be greater than the retirement age.",
          path: ["drawdown", "depleteAtAges", index],
        });
      }
    }
  });

export type WealthPlanConfig = z.infer<typeof wealthPlanConfigSchema>;

export const wealthProjectionRequestSchema = z
  .object({
    currency: currencySchema,
    currentAge: z.number().int().min(18).max(100),
    targetAge: z.number().int().min(19).max(110),
    initialBalance: nonNegativeMoneySchema,
    schedule: contributionScheduleSchema,
    annualReturnRates: z.array(annualReturnRateSchema).min(1).max(6),
    /** Lever scenarios compared against the baseline (same rates). */
    levers: z
      .array(
        z.object({
          name: nameSchema.max(60),
          initialBalance: nonNegativeMoneySchema.optional(),
          schedule: contributionScheduleSchema.optional(),
        }),
      )
      .max(4)
      .optional(),
  })
  .superRefine((value, context) => {
    if (value.targetAge <= value.currentAge) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Target age must be greater than the current age.",
        path: ["targetAge"],
      });
    }
    if ((value.targetAge - value.currentAge) * 12 > 720) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Projection horizon must be at most 60 years.",
        path: ["targetAge"],
      });
    }
    const leverNames = (value.levers ?? []).map((lever) => lever.name.toLowerCase());
    if (new Set(leverNames).size !== leverNames.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Lever names must be unique.",
        path: ["levers"],
      });
    }
    for (const [index, lever] of (value.levers ?? []).entries()) {
      if (lever.initialBalance === undefined && lever.schedule === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A lever must override the initial balance or the schedule.",
          path: ["levers", index],
        });
      }
    }
  });

export type WealthProjectionRequest = z.infer<typeof wealthProjectionRequestSchema>;

export const drawdownRequestSchema = z
  .object({
    currency: currencySchema,
    startingCapital: nonNegativeMoneySchema,
    startAge: z.number().int().min(40).max(100),
    annualReturnRates: z.array(annualReturnRateSchema).min(1).max(6),
    depleteAtAges: z.array(z.number().int().min(41).max(120)).min(1).max(4),
    /** Fixed-expense mode: monthly draw whose depletion age is computed. */
    monthlyExpense: positiveAmountSchema.optional(),
  })
  .superRefine((value, context) => {
    for (const [index, age] of value.depleteAtAges.entries()) {
      if (age <= value.startAge) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Depletion ages must be greater than the start age.",
          path: ["depleteAtAges", index],
        });
      }
    }
    if (new Set(value.depleteAtAges).size !== value.depleteAtAges.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Depletion ages must be unique.",
        path: ["depleteAtAges"],
      });
    }
  });

export type DrawdownRequest = z.infer<typeof drawdownRequestSchema>;

export const wealthPlanPersistSchema = z.object({
  name: nameSchema.max(60),
  currency: currencySchema,
  config: wealthPlanConfigSchema,
});

export type WealthPlanPersistRequest = z.infer<typeof wealthPlanPersistSchema>;
