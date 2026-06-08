import { describe, expect, it } from "vitest";

import { buildStatementRecords } from "@/lib/statements/commit";

function preview(rows: Array<Record<string, unknown>>) {
  return {
    contentHash: "hash",
    parserKey: "generic-csv",
    parserVersion: "1.0.0",
    institution: "UNKNOWN" as const,
    accountIdentity: undefined,
    openingBalance: undefined,
    closingBalance: undefined,
    warnings: [],
    rows: rows as never,
  };
}

describe("buildStatementRecords", () => {
  it("maps rows and drops in-file duplicates by dedupe hash", () => {
    const { records, duplicateInFileCount } = buildStatementRecords(
      preview([
        { rowNumber: 1, bookingDate: "2026-05-01", amount: "-12.5000", currency: "CHF", description: "Card payment 1234", counterparty: "Migros", originalRow: { a: 1 }, dedupeHash: "a" },
        { rowNumber: 2, bookingDate: "2026-05-02", amount: "100.0000", currency: "CHF", description: "Salary", originalRow: {}, dedupeHash: "b" },
        { rowNumber: 3, bookingDate: "2026-05-01", amount: "-12.5000", currency: "CHF", description: "Card payment 1234", counterparty: "Migros", originalRow: { a: 1 }, dedupeHash: "a" },
      ]),
      { householdId: "h1", statementImportId: "imp1", accountPocketId: "p1" },
    );

    expect(records).toHaveLength(2);
    expect(duplicateInFileCount).toBe(1);
    expect(records[0].bookingDate).toBeInstanceOf(Date);
    expect(records[0].amount).toBe("-12.5000");
    expect(records[0].reviewState).toBe("UNREVIEWED");
    expect(records[0].normalizedMerchantKey).toBe("migros");
    expect(records[0].householdId).toBe("h1");
    expect(records[0].accountPocketId).toBe("p1");
  });
});
