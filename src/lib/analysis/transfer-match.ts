import { money } from "@/lib/money/decimal";

export interface TransferCandidateRow {
  id: string;
  householdId: string;
  accountPocketId?: string;
  bookingDate: string;
  amount: string;
  currency: string;
  reference?: string;
  counterparty?: string;
}

export interface TransferCandidateScore {
  score: string;
  confidence: "high" | "medium" | "low";
  evidence: string[];
}

export function scoreTransferCandidate(
  debit: TransferCandidateRow,
  credit: TransferCandidateRow,
): TransferCandidateScore | null {
  if (debit.householdId !== credit.householdId) return null;
  if (debit.accountPocketId && debit.accountPocketId === credit.accountPocketId) return null;
  if (!money(debit.amount).isNegative() || !money(credit.amount).isPositive()) return null;
  if (debit.currency !== credit.currency || !money(debit.amount).abs().equals(credit.amount)) return null;

  const evidence = ["opposite equal amounts", "same currency"];
  let score = 0.65;
  const dayDifference = Math.abs(
    (new Date(debit.bookingDate).getTime() - new Date(credit.bookingDate).getTime()) / 86_400_000,
  );
  if (dayDifference <= 1) { score += 0.15; evidence.push("booking dates within one day"); }
  if (debit.reference && credit.reference && normalize(debit.reference) === normalize(credit.reference)) {
    score += 0.15; evidence.push("matching reference");
  }
  if (debit.counterparty && credit.counterparty && normalize(debit.counterparty) === normalize(credit.counterparty)) {
    score += 0.05; evidence.push("matching counterparty");
  }
  const bounded = Math.min(score, 1);
  return {
    score: bounded.toFixed(6),
    confidence: bounded >= 0.9 ? "high" : bounded >= 0.7 ? "medium" : "low",
    evidence,
  };
}

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
