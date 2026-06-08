import { computeAdherence, type ActualCategoryInput, type PlannedCategoryInput } from "@/lib/analysis/adherence";
import type { FindingTransaction } from "@/lib/analysis/findings";
import { normalizeMonthly, type Recurrence } from "@/lib/budget/recurrence";
import { prisma } from "@/lib/db/prisma";

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function monthRange(month?: string | null): { month: string; start: Date; end: Date } {
  const base = month && /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);
  const [year, monthNumber] = base.split("-").map(Number);
  return {
    month: base,
    start: new Date(Date.UTC(year, monthNumber - 1, 1)),
    end: new Date(Date.UTC(year, monthNumber, 1)),
  };
}

export async function confirmedTransferTransactionIds(householdId: string): Promise<Set<string>> {
  const matches = await prisma.transactionTransferMatch.findMany({
    where: { householdId, status: "CONFIRMED" },
    select: { debitTransactionId: true, creditTransactionId: true },
  });
  return new Set(matches.flatMap((match) => [match.debitTransactionId, match.creditTransactionId]));
}

async function loadPlannedCategories(householdId: string): Promise<PlannedCategoryInput[]> {
  const items = await prisma.budgetItem.findMany({
    where: { householdId, deletedAt: null, kind: { not: "INCOME" } },
    include: { category: { select: { name: true } } },
  });
  return items.map((item) => ({
    categoryId: item.categoryId,
    categoryName: item.category.name,
    kind: item.kind,
    currency: item.currency,
    essential: item.essential,
    monthlyPlanned: normalizeMonthly({
      amount: item.amount.toString(),
      recurrence: item.recurrence.toLowerCase() as Recurrence,
      selectedMonths: item.selectedMonths,
    }).monthlyAmount,
  }));
}

async function loadActualByCategory(
  householdId: string,
  start: Date,
  end: Date,
  transferIds: Set<string>,
): Promise<ActualCategoryInput[]> {
  const allocations = await prisma.actualTransactionAllocation.findMany({
    where: {
      householdId,
      transaction: {
        ignored: false,
        bookingDate: { gte: start, lt: end },
        ...(transferIds.size > 0 ? { id: { notIn: [...transferIds] } } : {}),
      },
    },
    include: { transaction: { select: { currency: true } } },
  });
  return allocations.map((allocation) => ({
    categoryId: allocation.categoryId,
    currency: allocation.transaction.currency,
    amount: allocation.amount.toString(),
  }));
}

export async function adherenceForMonth(householdId: string, month?: string | null) {
  const range = monthRange(month);
  const transferIds = await confirmedTransferTransactionIds(householdId);
  const [planned, actual] = await Promise.all([
    loadPlannedCategories(householdId),
    loadActualByCategory(householdId, range.start, range.end, transferIds),
  ]);
  const { rows, totals } = computeAdherence(planned, actual);
  return { month: range.month, rows, totals };
}

export async function loadFindingTransactions(householdId: string): Promise<FindingTransaction[]> {
  const transferIds = await confirmedTransferTransactionIds(householdId);
  const transactions = await prisma.actualTransaction.findMany({
    where: { householdId, ignored: false },
    orderBy: { bookingDate: "desc" },
    take: 5000,
    include: { allocations: { select: { budgetItemId: true } } },
  });
  return transactions.map((transaction) => ({
    id: transaction.id,
    bookingDate: isoDate(transaction.bookingDate),
    amount: transaction.amount.toString(),
    currency: transaction.currency,
    description: transaction.description,
    merchantKey: transaction.normalizedMerchantKey,
    allocatedToBudgetItem: transaction.allocations.some((allocation) => allocation.budgetItemId !== null),
    isTransfer: transferIds.has(transaction.id),
    reviewState: transaction.reviewState,
  }));
}
