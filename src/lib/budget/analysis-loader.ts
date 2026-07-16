import { fromDbRecurrence } from "@/lib/budget/db-mapping";
import { computeBudgetAnalysis, type BudgetAnalysisResult, type BudgetLineInput } from "@/lib/budget/analysis";
import { normalizeMonthly } from "@/lib/budget/recurrence";
import { prisma } from "@/lib/db/prisma";
import { money, serializeMoney } from "@/lib/money/decimal";
import { reportingRateMap } from "@/lib/optimize/queries";

export interface BudgetAnalysisWithWarnings extends BudgetAnalysisResult {
  excludedCurrencyLines: string[];
}

/**
 * Loads and computes the Budget spend/savings analysis for a household, shared
 * between the /api/budget/analysis route and any server component that wants
 * the same figures without an extra client round-trip (e.g. dashboard cards).
 */
export async function loadBudgetAnalysis(householdId: string): Promise<BudgetAnalysisWithWarnings> {
  const [household, incomeSources, budgetItems] = await Promise.all([
    prisma.household.findUniqueOrThrow({
      where: { id: householdId },
      select: { baseCurrency: true },
    }),
    prisma.incomeSource.findMany({
      where: { householdId, deletedAt: null, active: true },
      select: { name: true, amount: true, currency: true, recurrence: true, selectedMonths: true },
      orderBy: { name: "asc" },
    }),
    prisma.budgetItem.findMany({
      where: { householdId, deletedAt: null, active: true },
      select: {
        name: true,
        amount: true,
        currency: true,
        recurrence: true,
        selectedMonths: true,
        kind: true,
        essential: true,
        category: { select: { name: true, group: { select: { name: true } } } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const reportingCurrency = household.baseCurrency;
  const rates = await reportingRateMap(householdId, reportingCurrency);
  const rateFor = (currency: string): string | null => {
    if (currency === reportingCurrency) return "1";
    return rates[currency] ?? null;
  };

  const excluded = new Set<string>();
  const lines: BudgetLineInput[] = [];

  const monthlyInBase = (amount: string, currency: string, recurrence: string, selectedMonths: number[]): string | null => {
    const rate = rateFor(currency);
    if (rate === null) {
      excluded.add(currency);
      return null;
    }
    const monthly = normalizeMonthly({
      amount,
      recurrence: fromDbRecurrence(recurrence as never),
      selectedMonths,
    }).monthlyAmount;
    return serializeMoney(money(monthly).times(money(rate)));
  };

  for (const source of incomeSources) {
    const monthly = monthlyInBase(source.amount.toString(), source.currency, source.recurrence, source.selectedMonths);
    if (monthly === null) continue;
    lines.push({
      name: source.name,
      group: "Income",
      category: source.name,
      kind: "INCOME",
      essential: false,
      monthlyAmount: monthly,
    });
  }

  for (const item of budgetItems) {
    const monthly = monthlyInBase(item.amount.toString(), item.currency, item.recurrence, item.selectedMonths);
    if (monthly === null) continue;
    lines.push({
      name: item.name,
      group: item.category.group.name,
      category: item.category.name,
      kind: item.kind as BudgetLineInput["kind"],
      essential: item.essential,
      monthlyAmount: monthly,
      // A non-monthly expense is a provision: an annual/periodic bill saved
      // monthly (weekly and one-time recurrences are not provisions).
      provision:
        item.kind === "EXPENSE" &&
        (item.recurrence === "QUARTERLY" || item.recurrence === "YEARLY" || item.recurrence === "CUSTOM_MONTHS"),
    });
  }

  const analysis = computeBudgetAnalysis({ reportingCurrency, lines });
  return { ...analysis, excludedCurrencyLines: [...excluded].sort() };
}
