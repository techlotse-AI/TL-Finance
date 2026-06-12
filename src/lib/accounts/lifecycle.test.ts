import { describe, expect, it } from "vitest";

import {
  activePlanReferenceCount,
  historicalReferenceCount,
  type AccountLifecycleSummary,
} from "@/lib/accounts/lifecycle";

const summary: AccountLifecycleSummary = {
  incomeAllocations: 1,
  outgoingTransfers: 2,
  incomingTransfers: 3,
  fundedBudgetItems: 4,
  receivingBudgetItems: 5,
  actualTransactions: 20,
  statementImports: 2,
};

describe("account lifecycle", () => {
  it("blocks deletion only for active planned-flow references", () => {
    expect(activePlanReferenceCount(summary)).toBe(15);
  });

  it("reports Analyze history separately because soft deletion preserves it", () => {
    expect(historicalReferenceCount(summary)).toBe(22);
  });
});
