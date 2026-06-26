import type { PrismaClient } from "@prisma/client";

import { ApiError } from "@/lib/api/errors";
import { fromDbRecurrence } from "@/lib/budget/db-mapping";
import { buildMoneyFlow } from "@/lib/budget/money-flow";
import { normalizeMonthly } from "@/lib/budget/recurrence";
import { money, serializeMoney, sumMoney } from "@/lib/money/decimal";

type PlanClient = Pick<
  PrismaClient,
  "household" | "accountPocket" | "incomeSource" | "plannedAccountTransfer" | "budgetItem" | "exchangeRate"
>;

export async function buildPersistedMoneyFlow(client: PlanClient, householdId: string) {
  const [household, pockets, incomeSources, transfers, budgetItems, exchangeRates] = await Promise.all([
    client.household.findUnique({
      where: { id: householdId },
      select: { baseCurrency: true },
    }),
    client.accountPocket.findMany({
      where: { householdId, deletedAt: null, active: true, account: { deletedAt: null, active: true } },
      select: { id: true, name: true, currency: true, account: { select: { name: true, spending: true } } },
      orderBy: [{ account: { name: "asc" } }, { currency: "asc" }],
    }),
    client.incomeSource.findMany({
      where: { householdId, deletedAt: null, active: true },
      include: {
        allocations: {
          where: { householdId, deletedAt: null, active: true },
          select: { accountPocketId: true, method: true, fixedAmount: true, percentage: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    client.plannedAccountTransfer.findMany({
      where: { householdId, deletedAt: null, active: true },
      orderBy: { name: "asc" },
    }),
    client.budgetItem.findMany({
      where: { householdId, deletedAt: null, active: true },
      include: { category: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    client.exchangeRate.findMany({
      where: { householdId },
      orderBy: { asOf: "desc" },
    }),
  ]);

  if (!household) {
    throw new ApiError(404, "household_not_found", "Household was not found.");
  }
  const baseCurrency = household.baseCurrency;

  const currencies = new Set([
    ...pockets.map((pocket) => pocket.currency),
    ...incomeSources.map((source) => source.currency),
    ...transfers.map((transfer) => transfer.currency),
    ...budgetItems.map((item) => item.currency),
  ]);

  const latestRates = [...currencies]
    .filter((currency) => currency !== baseCurrency)
    .map((currency) => exchangeRates.find((rate) => rate.fromCurrency === currency && rate.toCurrency === baseCurrency));
  if (latestRates.some((rate) => !rate)) {
    throw new ApiError(
      409,
      "exchange_rates_required",
      "A reporting exchange rate is required for non-base-currency rows.",
    );
  }

  const flow = buildMoneyFlow({
    reportingCurrency: baseCurrency,
    exchangeRates: latestRates.filter((rate) => rate != null).map((rate) => ({
      currency: rate.fromCurrency,
      rateToReportingCurrency: rate.rate.toString(),
    })),
    oneTimeIncomeTotal: serializeMoney(sumMoney([
      ...incomeSources.filter((source) => source.recurrence === "ONCE").map((source) => convertToBase(source.amount.toString(), source.currency)),
    ])),
    oneTimeUseTotal: serializeMoney(sumMoney([
      ...budgetItems.filter((item) => item.recurrence === "ONCE").map((item) => convertToBase(item.amount.toString(), item.currency)),
    ])),
    pockets: pockets.map((pocket) => ({
      id: pocket.id,
      name: `${pocket.account.name} · ${pocket.currency}`,
      currency: pocket.currency,
      spending: pocket.account.spending,
    })),
    incomeSources: incomeSources.map((source) => {
      const normalized = normalizeMonthly({
        amount: source.amount.toString(),
        recurrence: fromDbRecurrence(source.recurrence),
        selectedMonths: source.selectedMonths,
      });

      return {
        id: source.id,
        name: source.name,
        currency: source.currency,
        monthlyAmount: normalized.monthlyAmount,
        allocations: source.allocations.map((allocation) => ({
          pocketId: allocation.accountPocketId,
          amount:
            allocation.method === "FIXED"
              ? normalizeMonthly({
                  amount: allocation.fixedAmount?.toString() ?? "0",
                  recurrence: fromDbRecurrence(source.recurrence),
                  selectedMonths: source.selectedMonths,
                }).monthlyAmount
              : normalizeMonthly({
                  amount: source.amount.times(allocation.percentage ?? 0).toString(),
                  recurrence: fromDbRecurrence(source.recurrence),
                  selectedMonths: source.selectedMonths,
                }).monthlyAmount,
        })),
      };
    }),
    transfers: transfers.map((transfer) => ({
      id: transfer.id,
      name: transfer.name,
      currency: transfer.currency,
      monthlyAmount: normalizeMonthly({
        amount: transfer.amount.toString(),
        recurrence: fromDbRecurrence(transfer.recurrence),
        selectedMonths: transfer.selectedMonths,
      }).monthlyAmount,
      fromPocketId: transfer.fromAccountPocketId,
      toPocketId: transfer.toAccountPocketId,
    })),
    budgetItems: budgetItems.map((item) => ({
      id: item.id,
      name: item.name,
      kind: item.kind.toLowerCase() as "expense" | "saving" | "investment" | "retirement",
      categoryId: item.categoryId,
      categoryName: item.category.name,
      currency: item.currency,
      monthlyAmount: normalizeMonthly({
        amount: item.amount.toString(),
        recurrence: fromDbRecurrence(item.recurrence),
        selectedMonths: item.selectedMonths,
      }).monthlyAmount,
      paidFromPocketId: item.paidFromAccountPocketId ?? undefined,
      paidToPocketId: item.paidToAccountPocketId ?? undefined,
    })),
  });
  for (const rate of latestRates) {
    if (rate && rate.staleAfter.getTime() < Date.now()) {
      flow.warnings.push({
        code: "stale_exchange_rate",
        message: `${rate.fromCurrency} to ${rate.toCurrency} reporting rate is stale.`,
        resourceId: rate.id,
        amount: "0.0000",
      });
      flow.reconciled = false;
    }
  }
  return flow;

  function convertToBase(value: string, currency: string) {
    if (currency === baseCurrency) return money(value);
    const rate = latestRates.find((candidate) => candidate?.fromCurrency === currency);
    if (!rate) throw new ApiError(409, "exchange_rates_required", `A ${currency} reporting rate is required.`);
    return money(value).times(rate.rate.toString());
  }
}
