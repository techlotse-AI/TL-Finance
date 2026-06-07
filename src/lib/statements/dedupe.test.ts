import { describe, expect, it } from "vitest";

import { statementContentHash, transactionDedupeHash } from "@/lib/statements/dedupe";

describe("statement dedupe", () => {
  it("produces stable file and row hashes", () => {
    expect(statementContentHash(new Uint8Array([1, 2, 3]))).toBe(statementContentHash(new Uint8Array([1, 2, 3])));
    const row = { rowNumber: 1, bookingDate: "2026-01-01", amount: "-10.0000", currency: "CHF", description: " Shop  Name ", originalRow: {} };
    expect(transactionDedupeHash("UBS", "account", row)).toBe(transactionDedupeHash("UBS", "account", { ...row, description: "shop name" }));
  });
});
