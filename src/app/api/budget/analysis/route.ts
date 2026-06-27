import { json, routeError } from "@/lib/api/route";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { fromDbRecurrence } from "@/lib/budget/db-mapping";
import { computeBudgetAnalysis, type BudgetLineInput } from "@/lib/budget/analysis";
import { normalizeMonthly } from "@/lib/budget/recurrence";
import { money, serializeMoney } from "@/lib/money/decimal";
import { reportingRateMap } from "@/lib/optimize/queries";
import { prisma } from "@/lib/db/prisma";

/**
 * Budget analysis: where the money goes, 50/30/20 comparison, savings
 * opportunities and zero-based balance, derived from the persisted plan. Amounts
 * are recurrence-normalized to monthly and converted to the household base
 * currency via the latest reporting rates. Lines whose currency has no reporting
 * rate are excluded and reported in `excludedCurrencyLines` so the UI can warn.
 */
export async function GET() {
  try {
    const context = await requireAuthenticatedContext("budget.read");

    const [household, incomeSources, budgetItems] = await Promise.all([
      prisma.household.findUniqueOrThrow({
        where: { id: context.householdId },
        select: { baseCurrency: true },
      }),
      prisma.incomeSource.findMany({
        where: { householdId: context.householdId, deletedAt: null, active: true },
        select: { name: true, amount: true, currency: true, recurrence: true, selectedMonths: true },
        orderBy: { name: "asc" },
      }),
      prisma.budgetItem.findMany({
        where: { householdId: context.householdId, deletedAt: null, active: true },
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
    const rates = await reportingRateMap(context.householdId, reportingCurrency);
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
      });
    }

    const analysis = computeBudgetAnalysis({ reportingCurrency, lines });
    return json({ ...analysis, excludedCurrencyLines: [...excluded].sort() });
  } catch (error) {
    return routeError(error);
  }
}
