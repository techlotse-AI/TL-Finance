import { money, serializeMoney } from "@/lib/money/decimal";
import type { AdherenceRow } from "@/lib/analysis/adherence";

export type FindingSeverity = "info" | "warning" | "high";

export interface Finding {
  code: string;
  severity: FindingSeverity;
  title: string;
  detail: string;
  currency?: string;
  amount?: string;
  transactionIds?: string[];
}

export interface FindingTransaction {
  id: string;
  bookingDate: string;
  amount: string;
  currency: string;
  description: string;
  merchantKey: string | null;
  allocatedToBudgetItem: boolean;
  isTransfer: boolean;
  reviewState: string;
}

function spendKey(transaction: FindingTransaction): string {
  const label = transaction.merchantKey || transaction.description.toLowerCase().slice(0, 40);
  return `${label}|${transaction.currency}`;
}

function daySpan(dates: string[]): number {
  const times = dates.map((date) => new Date(date).getTime());
  return (Math.max(...times) - Math.min(...times)) / 86_400_000;
}

/**
 * Derives deterministic money-leak findings from analyzed actuals and adherence.
 * No AI, no fuzzy scoring: every finding is reproducible from the same input.
 */
export function computeFindings(
  transactions: FindingTransaction[],
  adherence: AdherenceRow[],
): Finding[] {
  const findings: Finding[] = [];
  const spending = transactions.filter((transaction) => !transaction.isTransfer && money(transaction.amount).isNegative());

  // 1. Over-budget categories.
  for (const row of adherence) {
    if (row.kind !== "EXPENSE" || row.status !== "over") continue;
    const overspend = money(row.actual).minus(row.planned);
    if (overspend.lessThanOrEqualTo(0)) continue;
    findings.push({
      code: "over_budget",
      severity: overspend.greaterThan(money(row.planned).times(0.25)) ? "high" : "warning",
      title: `Over budget: ${row.categoryName}`,
      detail: `Spent ${row.actual} of ${row.planned} ${row.currency} planned (${row.usedPercent ?? 0}%).`,
      currency: row.currency,
      amount: serializeMoney(overspend),
    });
  }

  // 2. Duplicate charges: same merchant + amount, clustered in time.
  const exactGroups = new Map<string, FindingTransaction[]>();
  for (const transaction of spending) {
    const id = `${spendKey(transaction)}|${transaction.amount}`;
    const group = exactGroups.get(id) ?? [];
    group.push(transaction);
    exactGroups.set(id, group);
  }
  for (const group of exactGroups.values()) {
    if (group.length < 2) continue;
    if (daySpan(group.map((transaction) => transaction.bookingDate)) > 4) continue;
    findings.push({
      code: "duplicate_charge",
      severity: "warning",
      title: `Possible duplicate charge: ${group[0].description}`,
      detail: `${group.length} identical charges of ${group[0].amount} ${group[0].currency} within a few days.`,
      currency: group[0].currency,
      amount: serializeMoney(money(group[0].amount).abs()),
      transactionIds: group.map((transaction) => transaction.id),
    });
  }

  // 3. Recurring subscriptions across three or more months.
  const recurring = new Map<string, FindingTransaction[]>();
  for (const transaction of spending) {
    if (!transaction.merchantKey) continue;
    const group = recurring.get(spendKey(transaction)) ?? [];
    group.push(transaction);
    recurring.set(spendKey(transaction), group);
  }
  for (const group of recurring.values()) {
    const months = new Set(group.map((transaction) => transaction.bookingDate.slice(0, 7)));
    if (months.size < 3) continue;
    const ordered = [...group].sort((a, b) => a.bookingDate.localeCompare(b.bookingDate));
    const first = money(ordered[0].amount).abs();
    const latest = money(ordered[ordered.length - 1].amount).abs();
    const untracked = group.every((transaction) => !transaction.allocatedToBudgetItem);
    const increased = latest.greaterThan(first.times(1.02));
    findings.push({
      code: increased ? "subscription_increase" : "recurring_subscription",
      severity: increased ? "warning" : "info",
      title: `${increased ? "Rising" : "Recurring"} charge: ${ordered[0].description}`,
      detail: `${months.size} monthly charges${untracked ? ", not tied to a budget item" : ""}. Latest ${serializeMoney(latest)} ${ordered[0].currency}/month (~${serializeMoney(latest.times(12))}/year).${increased ? ` Up from ${serializeMoney(first)}.` : ""}`,
      currency: ordered[0].currency,
      amount: serializeMoney(latest),
      transactionIds: ordered.map((transaction) => transaction.id),
    });
  }

  // 4. Review backlog.
  const backlog = transactions.filter(
    (transaction) => transaction.reviewState === "UNREVIEWED" || transaction.reviewState === "PARTIAL",
  );
  if (backlog.length > 0) {
    findings.push({
      code: "review_backlog",
      severity: "info",
      title: `${backlog.length} transactions awaiting review`,
      detail: "Unreviewed actuals are excluded from adherence until categorized.",
      transactionIds: backlog.slice(0, 50).map((transaction) => transaction.id),
    });
  }

  const order: Record<FindingSeverity, number> = { high: 0, warning: 1, info: 2 };
  findings.sort((left, right) => order[left.severity] - order[right.severity]);
  return findings;
}
