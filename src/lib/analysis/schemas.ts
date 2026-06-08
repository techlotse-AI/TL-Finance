import { z } from "zod";

const moneyString = z
  .string()
  .trim()
  .regex(/^-?\d+(\.\d{1,4})?$/, "Amount must be a decimal string with up to four places.");

const cuid = z.string().trim().min(1).max(64);

export const statementPreviewSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  contentBase64: z.string().min(1).max(15_000_000),
  contentType: z.string().max(120).optional(),
});

export const statementCommitSchema = statementPreviewSchema.extend({
  accountPocketId: cuid,
});

export const allocateTransactionSchema = z.object({
  allocations: z
    .array(
      z.object({
        categoryId: cuid,
        budgetItemId: cuid.optional(),
        amount: moneyString,
      }),
    )
    .min(1)
    .max(20),
  confirm: z.boolean().default(true),
});

export const ignoreTransactionSchema = z.object({
  ignored: z.boolean(),
});

export const createRuleSchema = z.object({
  matchField: z.enum(["description", "merchant", "counterparty", "reference"]),
  matchType: z.enum(["exact", "contains", "prefix", "regex"]),
  pattern: z.string().trim().min(1).max(200),
  institution: z
    .enum([
      "UBS",
      "REVOLUT",
      "ZUGER_KANTONALBANK",
      "FNB",
      "STANDARD_BANK",
      "INVESTEC",
      "FRANKLY",
      "VIAC",
      "SAXO",
      "UNKNOWN",
    ])
    .optional(),
  categoryId: cuid,
  budgetItemId: cuid.optional(),
  priority: z.number().int().min(0).max(1000).default(100),
});

export const applyRulesSchema = z.object({
  onlyUnreviewed: z.boolean().default(true),
});

export const transferScanSchema = z.object({
  windowDays: z.number().int().min(0).max(14).default(3),
});

export const transferDecisionSchema = z.object({
  decision: z.enum(["confirmed", "rejected"]),
});

export const analysisPeriodSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});
