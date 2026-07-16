import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { money } from "@/lib/money/decimal";
import { fnbCurrentAccountParser, parseFnbCurrentAccountText } from "@/lib/statements/parsers/fnb-current-account";

/**
 * These fixtures are sanitized-but-real: the transaction structure, amounts,
 * dates, and every documented format quirk (Cr-suffix sign convention,
 * dropped "#Monthly Account Fee" description, embedded purchase-date inside
 * a POS description) are copied from two real FNB Private Clients Current
 * Account statements, one month apart. Only the name, address, and account
 * number are fabricated. See fnb-current-account.ts's module doc comment for
 * what was verified against the real files.
 *
 * Only the pure text-to-transactions function is golden-tested here — the
 * StatementParser.parse() adapter's PDF-byte-extraction step needs a real
 * PDF file to exercise, which isn't something to fabricate or commit; that
 * glue is thin (extract text, then call this function) and low-risk by
 * comparison.
 */
function fixtureText(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), "utf-8");
}

describe("parseFnbCurrentAccountText — statement 1 (Aug–Sep, 11 rows)", () => {
  const result = parseFnbCurrentAccountText(fixtureText("fnb-current-account-1.txt"));

  it("has no warnings and reads every transaction row", () => {
    expect(result.warnings).toHaveLength(0);
    expect(result.rows).toHaveLength(11);
  });

  it("reads the account number and opening/closing balances", () => {
    expect(result.accountNumber).toBe("62399912345");
    expect(result.openingBalance).toBe("124066.4100");
    expect(result.closingBalance).toBe("115275.2600");
  });

  it("resolves the year for dates in both months of the statement period", () => {
    expect(result.rows[0].bookingDate).toBe("2025-08-30"); // "30 Aug" -> August (start month)
    expect(result.rows[2].bookingDate).toBe("2025-09-01"); // "01 Sep" -> September (end month)
  });

  it("treats a bare amount as a debit (negative) and a Cr-suffixed amount as a credit (positive)", () => {
    expect(result.rows[0].amount).toBe("-745.0000"); // debit, no suffix
    expect(result.rows[8].amount).toBe("15200.0000"); // "FNB App Payment From ..." credit, Cr suffix
  });

  it("does not mistake a POS purchase's embedded spend-date for a new row boundary", () => {
    const pos = result.rows[6];
    expect(pos.description).toBe("POS Purchase Mp *Samplegear 400738*9013 01 Sep");
    expect(pos.amount).toBe("-2540.0000");
    expect(pos.balanceAfter).toBe("105170.2600");
  });

  it("falls back to \"Monthly Account Fee\" when the description is dropped by PDF extraction", () => {
    const fee = result.rows[10];
    expect(fee.description).toBe("Monthly Account Fee");
    expect(fee.amount).toBe("-495.0000");
    expect(fee.balanceAfter).toBe("115275.2600");
  });

  it("reconciles every row's running balance exactly, opening balance to closing balance", () => {
    let running = money(result.openingBalance!);
    for (const row of result.rows) {
      running = running.plus(row.amount);
      expect(running.toFixed(4)).toBe(money(row.balanceAfter).toFixed(4));
    }
    expect(running.toFixed(4)).toBe(money(result.closingBalance!).toFixed(4));
  });
});

describe("parseFnbCurrentAccountText — statement 2 (Oct–Nov, 9 rows, leads with a credit)", () => {
  const result = parseFnbCurrentAccountText(fixtureText("fnb-current-account-2.txt"));

  it("has no warnings and reads every transaction row", () => {
    expect(result.warnings).toHaveLength(0);
    expect(result.rows).toHaveLength(9);
  });

  it("reads a credit-first statement (Magtape Credit) correctly", () => {
    expect(result.rows[0]).toMatchObject({ bookingDate: "2025-10-24", amount: "5000.0000" });
    expect(result.rows[0].description).toContain("Magtape Credit");
  });

  it("resolves dates spanning the Oct–Nov statement period boundary", () => {
    expect(result.rows[3].bookingDate).toBe("2025-10-31");
    expect(result.rows[4].bookingDate).toBe("2025-11-01");
  });

  it("reconciles every row's running balance exactly, opening balance to closing balance", () => {
    let running = money(result.openingBalance!);
    for (const row of result.rows) {
      running = running.plus(row.amount);
      expect(running.toFixed(4)).toBe(money(row.balanceAfter).toFixed(4));
    }
    expect(running.toFixed(4)).toBe(money(result.closingBalance!).toFixed(4));
  });
});

describe("parseFnbCurrentAccountText — fails closed on unrecognized content", () => {
  it("returns an empty row list with a warning instead of guessing", () => {
    const result = parseFnbCurrentAccountText("this is not a statement at all\njust prose\n");
    expect(result.rows).toHaveLength(0);
    expect(result.warnings[0]?.code).toBe("unrecognized_statement");
  });
});

describe("fnbCurrentAccountParser.detect", () => {
  it("recognizes PDF magic bytes and rejects everything else", () => {
    const pdfBytes = new TextEncoder().encode("%PDF-1.4\n...");
    expect(fnbCurrentAccountParser.detect({ filename: "statement.pdf", content: pdfBytes }).confidence).toBeGreaterThan(0);

    const csvBytes = new TextEncoder().encode("Date,Amount,Balance,Description\n");
    expect(fnbCurrentAccountParser.detect({ filename: "statement.csv", content: csvBytes }).confidence).toBe(0);
  });
});
