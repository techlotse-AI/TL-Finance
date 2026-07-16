import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { money } from "@/lib/money/decimal";
import { fnbTransactionHistoryParser } from "@/lib/statements/parsers/fnb-transaction-history";

/**
 * Sanitized-but-real, like every other fixture in this directory: amounts,
 * dates, and the file's structural quirks (metadata preamble before the real
 * header, "#"-prefixed fee descriptions, newest-first row order) are copied
 * from a real FNB "ACCOUNT TRANSACTION HISTORY" CSV export. Only the name,
 * account number, and a couple of merchant/sender names are fabricated.
 *
 * Only one real export was available (this format only covers whatever
 * window the user pulls, observed as one month, so a second sample from a
 * different month wasn't practical to get in the same session) — this
 * parser is registered and fully functional, but per AGENTS.md's
 * two-real-fixture rule for production-ready status, it's catalogued as
 * `productionReady: false` (not yet advertised in the import picker) until
 * a second real sample confirms the format is stable across exports.
 */
function fixtureBytes(name: string): Uint8Array {
  return new Uint8Array(readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url))));
}

describe("fnbTransactionHistoryParser.detect", () => {
  it("recognizes the ACCOUNT TRANSACTION HISTORY title and header", () => {
    const detection = fnbTransactionHistoryParser.detect({ filename: "history.csv", content: fixtureBytes("fnb-transaction-history-1.csv") });
    expect(detection.confidence).toBeGreaterThan(0.9);
  });

  it("rejects content without the title", () => {
    const content = new TextEncoder().encode("Date,Amount,Balance,Description\n2026/07/15,-10.00,100.00,Coffee\n");
    expect(fnbTransactionHistoryParser.detect({ filename: "x.csv", content }).confidence).toBe(0);
  });
});

describe("fnbTransactionHistoryParser.parse", () => {
  it("skips the metadata preamble and reads every transaction row", async () => {
    const result = await fnbTransactionHistoryParser.parse({ filename: "history.csv", content: fixtureBytes("fnb-transaction-history-1.csv") });
    expect(result.rows).toHaveLength(11);
    expect(result.warnings).toHaveLength(0);
  });

  it("masks the account number extracted from the \"Account:\" metadata line", async () => {
    const result = await fnbTransactionHistoryParser.parse({ filename: "history.csv", content: fixtureBytes("fnb-transaction-history-1.csv") });
    expect(result.accountIdentity).toBe("•••••••2345");
    expect(result.accountMatchReference).toBe("•••••••2345");
  });

  it("reads year-first slash dates and the already-signed amount directly, no Cr/Dr suffix", async () => {
    const result = await fnbTransactionHistoryParser.parse({ filename: "history.csv", content: fixtureBytes("fnb-transaction-history-1.csv") });
    const first = result.rows[0];
    expect(first.bookingDate).toBe("2026-07-15");
    expect(first.amount).toBe("-125.0000");
    expect(first.currency).toBe("ZAR");
    expect(first.description).toBe("#MONTHLY ACCOUNT FEE");

    const credit = result.rows.find((row) => Number(row.amount) > 0);
    expect(credit?.amount).toBe("11000.0000");
  });

  it("does not assume chronological file order — each row's balance is read directly, not derived from the previous row", async () => {
    const result = await fnbTransactionHistoryParser.parse({ filename: "history.csv", content: fixtureBytes("fnb-transaction-history-1.csv") });
    // The file is newest-first: row 0 is 2026/07/15 with balance 4934.81,
    // row 1 is also 2026/07/15 (same day, different transaction) with a
    // higher balance 5059.81 — confirms this parser reads the printed
    // balance per row rather than assuming an ascending/descending order.
    expect(result.rows[0].balanceAfter).toBe(money("4934.81").toFixed(4));
    expect(result.rows[1].balanceAfter).toBe(money("5059.81").toFixed(4));
  });
});
