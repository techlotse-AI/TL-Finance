import { isValidAccountReference, maskAccountReference } from "@/lib/accounts/reference";
import { cellAt, decodeStatementText, headerIndex, parseDelimited } from "@/lib/statements/csv";
import {
  cleanText,
  normalizeAmount,
  normalizeDate,
  rowObject,
  skipWarning,
} from "@/lib/statements/parsers/shared";
import type {
  NormalizedStatement,
  NormalizedStatementRow,
  ParserDetection,
  StatementInput,
  StatementParser,
  StatementWarning,
} from "@/lib/statements/types";

const HEADER_LINE = /^Date,\s*Amount,\s*Balance,\s*Description/im;
const ACCOUNT_LINE = /Account:,\s*(\d{6,20})/;

/**
 * FNB "ACCOUNT TRANSACTION HISTORY" CSV export — FNB online banking's
 * transaction-history download, distinct from the PDF "Tax
 * Invoice/Statement" (see fnb-current-account.ts, the primary parser for
 * this institution). Comma-delimited with a metadata preamble (title,
 * "Name:", "Account:", "Balance:" lines, a blank line) before the real
 * "Date, Amount, Balance, Description" header — parseDelimited's normal
 * "header on line 1" assumption doesn't hold, so this locates the header
 * line directly and slices from there rather than using headerOffset
 * (simpler than replicating parseDelimited's own blank-line filtering).
 *
 * Amount is already signed (no separate debit/credit columns, no Cr/Dr
 * suffix like the PDF statement); dates are year-first "YYYY/MM/DD"; there
 * is no currency column (FNB, always ZAR). Rows are newest-first in the
 * source file — this parser does not depend on or assume file order.
 *
 * This export only covers whatever window the user pulls (observed: one
 * calendar month) — the PDF statement (fnb-current-account.ts) remains the
 * primary, full-period source; this is a secondary/supplementary format.
 */
export const fnbTransactionHistoryParser: StatementParser = {
  key: "fnb-transaction-history",
  institution: "FNB",
  version: "1.0.0",

  detect(input: StatementInput): ParserDetection {
    const text = decodeStatementText(input.content);
    if (!/^\s*ACCOUNT TRANSACTION HISTORY/i.test(text)) {
      return { confidence: 0, reasons: ["missing \"ACCOUNT TRANSACTION HISTORY\" title"] };
    }
    if (!HEADER_LINE.test(text)) {
      return { confidence: 0, reasons: ["missing Date/Amount/Balance/Description header"] };
    }
    return { confidence: 0.95, reasons: ["FNB account transaction history title and header"] };
  },

  async parse(input: StatementInput): Promise<NormalizedStatement> {
    const text = decodeStatementText(input.content);
    const headerMatch = HEADER_LINE.exec(text);
    if (!headerMatch) {
      throw new Error("Could not find the Date/Amount/Balance/Description header in this FNB export.");
    }

    const table = parseDelimited(text.slice(headerMatch.index), { delimiter: "," });
    const index = headerIndex(table.header);
    const col = (name: string) => index.get(name);

    const accountNumber = ACCOUNT_LINE.exec(text)?.[1];
    const accountReference = accountNumber && isValidAccountReference(accountNumber)
      ? maskAccountReference(accountNumber)
      : undefined;

    const rows: NormalizedStatementRow[] = [];
    const warnings: StatementWarning[] = [];

    table.rows.forEach((row, position) => {
      const rowNumber = position + 1;
      const bookingDate = normalizeDate(cellAt(row, col("date")));
      const amount = normalizeAmount(cellAt(row, col("amount")));
      const balance = normalizeAmount(cellAt(row, col("balance")));

      if (!bookingDate) {
        warnings.push(skipWarning(rowNumber, "ambiguous_date", "Could not read the date."));
        return;
      }
      if (amount === null) {
        warnings.push(skipWarning(rowNumber, "ambiguous_amount", "Could not read the amount."));
        return;
      }

      rows.push({
        rowNumber,
        bookingDate,
        amount,
        currency: "ZAR",
        description: cleanText(cellAt(row, col("description"))) ?? "Monthly Account Fee",
        balanceAfter: balance ?? undefined,
        originalRow: rowObject(table.header, row.cells),
      });
    });

    return {
      accountIdentity: accountReference,
      accountMatchReference: accountReference,
      rows,
      warnings,
    };
  },
};
