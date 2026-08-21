import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { money } from "@/lib/money/decimal";
import { fnbCurrentAccountParser } from "@/lib/statements/parsers/fnb-current-account";
import { investecCcmParser, parseInvestecCcmText } from "@/lib/statements/parsers/investec-ccm";

/**
 * These fixtures are sanitized-but-real: the transaction structure, amounts,
 * dates, and every documented format quirk (collapsed Debit/Credit columns,
 * amount-shaped numbers inside the admin-fee description, suffix-less
 * Opening/Closing balance rows, the agent VAT-number line that appears in
 * some months) are copied from two of eight real Investec CCM Call Account
 * statements, months apart. Only the names, address, account/client/invoice
 * numbers are fabricated. See investec-ccm.ts's module doc comment for what
 * was verified against the real files.
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

describe("parseInvestecCcmText — statement 1 (May 2026)", () => {
  const result = parseInvestecCcmText(fixtureText("investec-ccm-1.txt"));

  it("has no warnings and reads every transaction row", () => {
    expect(result.warnings).toHaveLength(0);
    expect(result.rows).toHaveLength(3);
  });

  it("reads the account number, currency, and opening/closing balances", () => {
    expect(result.accountNumber).toBe("50029998888");
    expect(result.currency).toBe("ZAR");
    expect(result.openingBalance).toBe("262.0100");
    expect(result.closingBalance).toBe("262.9900");
  });

  it("derives the sign from the running balance: interest is a credit, fees are debits", () => {
    expect(result.rows[0]).toMatchObject({ bookingDate: "2026-05-31", description: "Interest", amount: "1.4200" });
    expect(result.rows[1].amount).toBe("-0.3800");
    expect(result.rows[2]).toMatchObject({ description: "VAT on Admin fee", amount: "-0.0600" });
  });

  it("does not mistake the amount-shaped numbers inside the admin-fee description for the row amount", () => {
    const fee = result.rows[1];
    expect(fee.description).toBe("Intermediary Admin fee (excl. Vat) Admin Fee 2.00 incl. Vat");
    expect(fee.balanceAfter).toBe("263.0500");
  });

  it("carries both the posted and value dates", () => {
    expect(result.rows[0].valueDate).toBe("2026-05-31");
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

describe("parseInvestecCcmText — statement 2 (Dec 2025, with the agent VAT-number header line)", () => {
  const result = parseInvestecCcmText(fixtureText("investec-ccm-2.txt"));

  it("has no warnings and reads every transaction row", () => {
    expect(result.warnings).toHaveLength(0);
    expect(result.rows).toHaveLength(3);
  });

  it("reads the opening/closing balances across the year boundary format", () => {
    expect(result.openingBalance).toBe("257.3600");
    expect(result.closingBalance).toBe("258.3100");
    expect(result.rows[0].bookingDate).toBe("2025-12-31");
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

describe("parseInvestecCcmText — fails closed", () => {
  it("returns an empty row list with a warning instead of guessing on unrecognized content", () => {
    const result = parseInvestecCcmText("this is not a statement at all\njust prose\n");
    expect(result.rows).toHaveLength(0);
    expect(result.warnings[0]?.code).toBe("unrecognized_statement");
  });

  it("skips a row whose amount reconciles in neither direction, with a structured warning, and resumes the chain", () => {
    const doctored = fixtureText("investec-ccm-1.txt").replace("Interest 1.42 263.43CR", "Interest 9.99 263.43CR");
    const result = parseInvestecCcmText(doctored);
    expect(result.rows).toHaveLength(2); // the doctored row is skipped, the two fee rows survive
    expect(result.warnings.some((warning) => warning.code === "ambiguous_sign")).toBe(true);
    // The chain resumed from the doctored row's printed balance, so the fee rows still reconcile.
    expect(result.rows[0].amount).toBe("-0.3800");
  });

  it("warns when the final running balance does not match the printed closing balance", () => {
    const doctored = fixtureText("investec-ccm-1.txt").replace("Closing balance 262.99", "Closing balance 999.99");
    const result = parseInvestecCcmText(doctored);
    expect(result.warnings.some((warning) => warning.code === "unreconciled_balance")).toBe(true);
  });
});

describe("investecCcmParser.detect — never ties with the FNB PDF parser", () => {
  const markerPdf = new TextEncoder().encode(
    "%PDF-1.4\n<< /Creator <feff0044006f00630046007500730069006f006e> >>\n...",
  );
  const plainPdf = new TextEncoder().encode("%PDF-1.4\n...");
  const csvBytes = new TextEncoder().encode("Date,Amount,Balance,Description\n");

  it("claims a PDF carrying the Investec creator marker above FNB's blanket PDF claim", () => {
    const investec = investecCcmParser.detect({ filename: "statement.pdf", content: markerPdf });
    const fnb = fnbCurrentAccountParser.detect({ filename: "statement.pdf", content: markerPdf });
    expect(investec.confidence).toBeGreaterThan(fnb.confidence);
  });

  it("rejects a PDF without the marker so FNB's claim stands alone", () => {
    expect(investecCcmParser.detect({ filename: "statement.pdf", content: plainPdf }).confidence).toBe(0);
    expect(fnbCurrentAccountParser.detect({ filename: "statement.pdf", content: plainPdf }).confidence).toBeGreaterThan(0);
  });

  it("rejects non-PDF content outright", () => {
    expect(investecCcmParser.detect({ filename: "statement.csv", content: csvBytes }).confidence).toBe(0);
  });
});
