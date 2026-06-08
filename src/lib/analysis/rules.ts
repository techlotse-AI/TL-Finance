import { normalizePattern } from "@/lib/analysis/normalize";

export interface RuleLike {
  id: string;
  matchField: "DESCRIPTION" | "MERCHANT" | "COUNTERPARTY" | "REFERENCE";
  matchType: "EXACT" | "CONTAINS" | "PREFIX" | "REGEX";
  normalizedPattern: string;
  institution: string | null;
  categoryId: string;
  budgetItemId: string | null;
  priority: number;
}

export interface TransactionLike {
  description: string;
  counterparty: string | null;
  reference: string | null;
  normalizedMerchantKey: string | null;
  sourceInstitution: string;
}

/** Normalizes the pattern for storage. Regex patterns are preserved verbatim. */
export function patternForStorage(matchType: RuleLike["matchType"], raw: string): string {
  return matchType === "REGEX" ? raw.trim() : normalizePattern(raw);
}

function fieldValue(transaction: TransactionLike, field: RuleLike["matchField"]): string {
  switch (field) {
    case "DESCRIPTION":
      return normalizePattern(transaction.description ?? "");
    case "COUNTERPARTY":
      return normalizePattern(transaction.counterparty ?? "");
    case "REFERENCE":
      return normalizePattern(transaction.reference ?? "");
    case "MERCHANT":
      return transaction.normalizedMerchantKey ?? "";
  }
}

function ruleMatches(rule: RuleLike, transaction: TransactionLike): boolean {
  if (rule.institution && rule.institution !== transaction.sourceInstitution) return false;
  const value = fieldValue(transaction, rule.matchField);
  if (!value) return false;
  const pattern = rule.normalizedPattern;

  switch (rule.matchType) {
    case "EXACT":
      return value === pattern;
    case "CONTAINS":
      return value.includes(pattern);
    case "PREFIX":
      return value.startsWith(pattern);
    case "REGEX":
      try {
        return new RegExp(pattern, "i").test(value);
      } catch {
        return false;
      }
  }
}

/**
 * Returns the highest-priority rule that matches the transaction, or null when
 * none match. Callers pass rules pre-sorted by priority desc; this function
 * also defensively sorts so behavior is independent of input order.
 */
export function matchRule(transaction: TransactionLike, rules: RuleLike[]): RuleLike | null {
  const ordered = [...rules].sort((left, right) => right.priority - left.priority);
  for (const rule of ordered) {
    if (ruleMatches(rule, transaction)) return rule;
  }
  return null;
}
