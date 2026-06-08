import { money } from "@/lib/money/decimal";
import { scoreTransferCandidate, type TransferCandidateRow, type TransferCandidateScore } from "@/lib/analysis/transfer-match";

export interface TransferMatchCandidate extends TransferCandidateScore {
  debitId: string;
  creditId: string;
  fx: boolean;
}

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function dayDifference(a: string, b: string): number {
  return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);
}

/**
 * Scores a cross-currency (FX) transfer candidate. Because amounts and
 * currencies differ, an FX pair is only proposed when a shared reference or
 * counterparty links the two legs, keeping confidence conservative.
 */
export function scoreFxTransferCandidate(
  debit: TransferCandidateRow,
  credit: TransferCandidateRow,
  windowDays: number,
): TransferCandidateScore | null {
  if (debit.householdId !== credit.householdId) return null;
  if (debit.accountPocketId && debit.accountPocketId === credit.accountPocketId) return null;
  if (!money(debit.amount).isNegative() || !money(credit.amount).isPositive()) return null;
  if (debit.currency === credit.currency) return null;
  if (dayDifference(debit.bookingDate, credit.bookingDate) > windowDays) return null;

  const referenceMatch = Boolean(
    debit.reference && credit.reference && normalize(debit.reference) === normalize(credit.reference),
  );
  const counterpartyMatch = Boolean(
    debit.counterparty && credit.counterparty && normalize(debit.counterparty) === normalize(credit.counterparty),
  );
  if (!referenceMatch && !counterpartyMatch) return null;

  const evidence = ["cross-currency transfer"];
  let score = 0.55;
  if (referenceMatch) {
    score += 0.15;
    evidence.push("matching reference");
  }
  if (counterpartyMatch) {
    score += 0.05;
    evidence.push("matching counterparty");
  }
  if (dayDifference(debit.bookingDate, credit.bookingDate) <= 1) {
    score += 0.05;
    evidence.push("booking dates within one day");
  }
  const bounded = Math.min(score, 0.85);
  return {
    score: bounded.toFixed(6),
    confidence: bounded >= 0.9 ? "high" : bounded >= 0.7 ? "medium" : "low",
    evidence,
  };
}

/**
 * Finds one-to-one transfer/FX candidate pairs from a set of transactions using
 * a greedy highest-score-first assignment so each leg is used at most once.
 */
export function findTransferCandidates(
  rows: TransferCandidateRow[],
  windowDays = 3,
): TransferMatchCandidate[] {
  const debits = rows.filter((row) => money(row.amount).isNegative());
  const credits = rows.filter((row) => money(row.amount).isPositive());

  const scored: TransferMatchCandidate[] = [];
  for (const debit of debits) {
    for (const credit of credits) {
      if (debit.id === credit.id) continue;
      if (dayDifference(debit.bookingDate, credit.bookingDate) > windowDays) continue;
      const sameCurrency = scoreTransferCandidate(debit, credit);
      const result = sameCurrency ?? scoreFxTransferCandidate(debit, credit, windowDays);
      if (!result) continue;
      scored.push({ debitId: debit.id, creditId: credit.id, fx: !sameCurrency, ...result });
    }
  }

  scored.sort((left, right) => Number(right.score) - Number(left.score));

  const usedDebit = new Set<string>();
  const usedCredit = new Set<string>();
  const assigned: TransferMatchCandidate[] = [];
  for (const candidate of scored) {
    if (usedDebit.has(candidate.debitId) || usedCredit.has(candidate.creditId)) continue;
    usedDebit.add(candidate.debitId);
    usedCredit.add(candidate.creditId);
    assigned.push(candidate);
  }
  return assigned;
}
