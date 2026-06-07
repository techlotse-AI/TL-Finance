import { describe, expect, it } from "vitest";

import { scoreTransferCandidate } from "@/lib/analysis/transfer-match";

describe("transfer candidate scoring", () => {
  it("auto-confirm threshold requires strong deterministic evidence", () => {
    expect(scoreTransferCandidate(
      { id: "d", householdId: "h", accountPocketId: "a", bookingDate: "2026-01-01", amount: "-100", currency: "CHF", reference: "abc" },
      { id: "c", householdId: "h", accountPocketId: "b", bookingDate: "2026-01-01", amount: "100", currency: "CHF", reference: "ABC" },
    )?.confidence).toBe("high");
  });
  it("never matches across households", () => {
    expect(scoreTransferCandidate(
      { id: "d", householdId: "one", bookingDate: "2026-01-01", amount: "-100", currency: "CHF" },
      { id: "c", householdId: "two", bookingDate: "2026-01-01", amount: "100", currency: "CHF" },
    )).toBeNull();
  });
});
