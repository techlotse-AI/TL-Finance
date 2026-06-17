import { normalizeMonthly, type Recurrence } from "@/lib/budget/recurrence";
import { serializeMoney, sumMoney } from "@/lib/money/decimal";
import { prisma } from "@/lib/db/prisma";

/**
 * Latest reporting exchange rate per source currency into the base currency.
 * Returns a map of fromCurrency -> rate string. Missing currencies are simply
 * absent so callers can report them rather than failing closed.
 */
export async function reportingRateMap(
  householdId: string,
  baseCurrency: string,
): Promise<Record<string, string>> {
  const rates = await prisma.exchangeRate.findMany({
    where: { householdId, toCurrency: baseCurrency },
    orderBy: { asOf: "desc" },
    select: { fromCurrency: true, rate: true },
  });
  const map: Record<string, string> = {};
  for (const rate of rates) {
    if (map[rate.fromCurrency] === undefined) {
      map[rate.fromCurrency] = rate.rate.toString();
    }
  }
  return map;
}

/**
 * Sums recurrence-normalized monthly essential expense budget items in the
 * household base currency. Non-base-currency essentials are reported separately
 * so the UI can warn rather than silently mixing currencies.
 */
export async function essentialMonthlyBaseCurrency(householdId: string): Promise<{
  currency: string;
  essentialMonthly: string;
  excludedCurrencyItems: number;
}> {
  const household = await prisma.household.findUniqueOrThrow({
    where: { id: householdId },
    select: { baseCurrency: true },
  });

  const items = await prisma.budgetItem.findMany({
    where: { householdId, deletedAt: null, kind: "EXPENSE", essential: true },
    select: { amount: true, currency: true, recurrence: true, selectedMonths: true },
  });

  const inBase = items.filter((item) => item.currency === household.baseCurrency);
  const monthly = sumMoney(
    inBase.map((item) =>
      normalizeMonthly({
        amount: item.amount.toString(),
        recurrence: item.recurrence.toLowerCase() as Recurrence,
        selectedMonths: item.selectedMonths,
      }).monthlyAmount,
    ),
  );

  return {
    currency: household.baseCurrency,
    essentialMonthly: serializeMoney(monthly),
    excludedCurrencyItems: items.length - inBase.length,
  };
}
