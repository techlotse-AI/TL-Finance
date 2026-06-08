import type { MatchConfidence, RuleMatchField, RuleMatchType, TransferMatchStatus } from "@prisma/client";

export function toDbMatchField(value: "description" | "merchant" | "counterparty" | "reference"): RuleMatchField {
  return value.toUpperCase() as RuleMatchField;
}

export function toDbMatchType(value: "exact" | "contains" | "prefix" | "regex"): RuleMatchType {
  return value.toUpperCase() as RuleMatchType;
}

export function toDbConfidence(value: "high" | "medium" | "low"): MatchConfidence {
  return value.toUpperCase() as MatchConfidence;
}

export function toDbTransferStatus(value: "confirmed" | "rejected"): TransferMatchStatus {
  return value === "confirmed" ? "CONFIRMED" : "REJECTED";
}
