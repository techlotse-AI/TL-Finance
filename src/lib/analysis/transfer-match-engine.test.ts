import { describe, expect, it } from "vitest";

import { findTransferCandidates } from "@/lib/analysis/transfer-match-engine";
import type { TransferCandidateRow } from "@/lib/analysis/transfer-match";

function row(partial: Partial<TransferCandidateRow> & { id: string; amount: string }): TransferCandidateRow {
  return {
    householdId: "h1",
    accountPocketId: partial.id + "-pocket",
    bookingDate: "2026-05-10",
    currency: "CHF",
    ...partial,
  };
}

describe("findTransferCandidates", () => {
  it("matches opposite equal same-currency legs with high confidence", () => {
    const matches = findTransferCandidates([
      row({ id: "d", amount: "-2000.0000", accountPocketId: "checking", reference: "SO-1" }),
      row({ id: "c", amount: "2000.0000", accountPocketId: "savings", reference: "SO-1" }),
      row({ id: "x", amount: "-50.0000", accountPocketId: "checking" }),
    ]);
    expect(matches).toHaveLength(1);
    expect(matches[0].debitId).toBe("d");
    expect(matches[0].creditId).toBe("c");
    expect(matches[0].confidence).toBe("high");
    expect(matches[0].fx).toBe(false);
  });

  it("proposes FX pairs only when a reference links the legs", () => {
    const withReference = findTransferCandidates([
      row({ id: "d", amount: "-1000.0000", currency: "CHF", accountPocketId: "chf", reference: "FX-9" }),
      row({ id: "c", amount: "1040.0000", currency: "EUR", accountPocketId: "eur", reference: "FX-9" }),
    ]);
    expect(withReference).toHaveLength(1);
    expect(withReference[0].fx).toBe(true);

    const withoutReference = findTransferCandidates([
      row({ id: "d", amount: "-1000.0000", currency: "CHF", accountPocketId: "chf" }),
      row({ id: "c", amount: "1040.0000", currency: "EUR", accountPocketId: "eur" }),
    ]);
    expect(withoutReference).toHaveLength(0);
  });

  it("keeps assignment one-to-one", () => {
    const matches = findTransferCandidates([
      row({ id: "d", amount: "-100.0000", accountPocketId: "a", reference: "R" }),
      row({ id: "c1", amount: "100.0000", accountPocketId: "b", reference: "R" }),
      row({ id: "c2", amount: "100.0000", accountPocketId: "c", reference: "R" }),
    ]);
    expect(matches).toHaveLength(1);
  });
});
