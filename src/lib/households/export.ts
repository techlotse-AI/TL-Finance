import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { currencySchema, nameSchema, positiveMoneySchema } from "@/lib/budget/schemas";

type ExportClient = Pick<
  PrismaClient,
  "household" | "categoryGroup" | "category" | "account" | "accountPocket" | "incomeSource" | "plannedAccountTransfer" | "budgetItem" | "exchangeRate"
>;

export async function exportHousehold(client: ExportClient, householdId: string) {
  const [household, categoryGroups, categories, accounts, accountPockets, incomeSources, plannedTransfers, budgetItems, exchangeRates] =
    await Promise.all([
      client.household.findUniqueOrThrow({ where: { id: householdId }, select: { name: true, baseCurrency: true, countryProfile: true } }),
      client.categoryGroup.findMany({ where: { householdId, deletedAt: null }, orderBy: { sortOrder: "asc" } }),
      client.category.findMany({ where: { householdId, deletedAt: null }, orderBy: { sortOrder: "asc" } }),
      client.account.findMany({ where: { householdId, deletedAt: null }, orderBy: { name: "asc" } }),
      client.accountPocket.findMany({ where: { householdId, deletedAt: null }, orderBy: { name: "asc" } }),
      client.incomeSource.findMany({ where: { householdId, deletedAt: null }, include: { allocations: { where: { deletedAt: null } } }, orderBy: { name: "asc" } }),
      client.plannedAccountTransfer.findMany({ where: { householdId, deletedAt: null }, orderBy: { name: "asc" } }),
      client.budgetItem.findMany({ where: { householdId, deletedAt: null }, orderBy: { name: "asc" } }),
      client.exchangeRate.findMany({ where: { householdId }, orderBy: { asOf: "desc" } }),
    ]);
  return { format: "tl-finance-household", version: 1, exportedAt: new Date().toISOString(), household, categoryGroups, categories, accounts, accountPockets, incomeSources, plannedTransfers, budgetItems, exchangeRates };
}

const id = z.string().min(1).max(64);
const recurrence = z.enum(["ONCE", "WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY", "CUSTOM_MONTHS"]);
const dated = z.object({
  recurrence,
  selectedMonths: z.array(z.number().int().min(1).max(12)),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullable(),
});
const allocation = z.object({
  id,
  accountPocketId: id,
  method: z.enum(["FIXED", "PERCENTAGE"]),
  fixedAmount: positiveMoneySchema.nullable(),
  percentage: z.string().nullable(),
  sourceCurrency: currencySchema,
}).passthrough();
export const householdImportSchema = z.object({
  format: z.literal("tl-finance-household"),
  version: z.literal(1),
  household: z.object({ name: nameSchema, baseCurrency: currencySchema, countryProfile: z.enum(["generic", "swiss"]) }),
  categoryGroups: z.array(z.object({ id, name: nameSchema, sortOrder: z.number().int() }).passthrough()),
  categories: z.array(z.object({
    id, groupId: id, name: nameSchema,
    kind: z.enum(["INCOME", "EXPENSE", "SAVING", "INVESTMENT", "RETIREMENT"]),
    essential: z.boolean(), sortOrder: z.number().int(),
  }).passthrough()),
  accounts: z.array(z.object({
    id, name: nameSchema,
    type: z.enum(["PERSONAL", "SAVINGS", "INVESTMENT", "RETIREMENT", "CREDIT_CARD", "CASH", "OTHER"]),
    institution: z.string().nullable(), maskedReference: z.string().nullable(),
  }).passthrough()),
  accountPockets: z.array(z.object({ id, accountId: id, name: nameSchema, currency: currencySchema }).passthrough()),
  incomeSources: z.array(dated.extend({
    id, name: nameSchema, categoryId: id, amount: positiveMoneySchema, currency: currencySchema,
    allocations: z.array(allocation).min(1),
  }).passthrough()),
  plannedTransfers: z.array(dated.extend({
    id, name: nameSchema, fromAccountPocketId: id, toAccountPocketId: id,
    amount: positiveMoneySchema, currency: currencySchema,
  }).passthrough()),
  budgetItems: z.array(dated.extend({
    id, name: nameSchema, categoryId: id,
    kind: z.enum(["EXPENSE", "SAVING", "INVESTMENT", "RETIREMENT"]),
    amount: positiveMoneySchema, currency: currencySchema,
    paidFromAccountPocketId: id.nullable(), paidToAccountPocketId: id.nullable(), essential: z.boolean(),
  }).passthrough()),
  exchangeRates: z.array(z.object({
    fromCurrency: currencySchema, toCurrency: currencySchema, rate: positiveMoneySchema,
    asOf: z.coerce.date(), source: z.string().min(1), staleAfter: z.coerce.date(),
  }).passthrough()).default([]),
});

export type HouseholdImport = z.infer<typeof householdImportSchema>;
