import { describe, expect, it } from "vitest";

import { matchRule, patternForStorage, type RuleLike, type TransactionLike } from "@/lib/analysis/rules";

const transaction: TransactionLike = {
  description: "MIGROS ZUG 4051",
  counterparty: "Migros",
  reference: "REF-9",
  normalizedMerchantKey: "migros zug",
  sourceInstitution: "UBS",
};

function rule(partial: Partial<RuleLike>): RuleLike {
  return {
    id: "r",
    matchField: "MERCHANT",
    matchType: "CONTAINS",
    normalizedPattern: "migros",
    institution: null,
    categoryId: "groceries",
    budgetItemId: null,
    priority: 100,
    ...partial,
  };
}

describe("matchRule", () => {
  it("matches on the normalized merchant key", () => {
    expect(matchRule(transaction, [rule({})])?.categoryId).toBe("groceries");
  });

  it("respects priority order", () => {
    const matched = matchRule(transaction, [
      rule({ id: "low", categoryId: "a", priority: 10 }),
      rule({ id: "high", categoryId: "b", priority: 900 }),
    ]);
    expect(matched?.categoryId).toBe("b");
  });

  it("honors institution scoping", () => {
    expect(matchRule(transaction, [rule({ institution: "REVOLUT" })])).toBeNull();
  });

  it("supports regex without breaking on invalid patterns", () => {
    expect(matchRule(transaction, [rule({ matchField: "DESCRIPTION", matchType: "REGEX", normalizedPattern: "mig.*zug" })])?.categoryId).toBe("groceries");
    expect(matchRule(transaction, [rule({ matchType: "REGEX", normalizedPattern: "(" })])).toBeNull();
  });

  it("normalizes non-regex patterns for storage but preserves regex", () => {
    expect(patternForStorage("CONTAINS", "  Migros  Zug ")).toBe("migros zug");
    expect(patternForStorage("REGEX", "Mig.*ZUG")).toBe("Mig.*ZUG");
  });
});
