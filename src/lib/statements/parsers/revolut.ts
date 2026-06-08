import { cellAt, decodeStatementText, headerIndex, parseDelimited } from "@/lib/statements/csv";
import { money } from "@/lib/money/decimal";
import {
  cleanText,
  normalizeAmount,
  normalizeCurrency,
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

/**
 * Revolut transaction CSV. Comma-delimited with a pre-signed Amount column, a
 * separate Fee, and a State column. Only COMPLETED rows are imported; PENDING
 * and REVERTED rows are reported and skipped to keep actuals deterministic.
 */
export const revolutParser: StatementParser = {
  key: "revolut",
  institution: "REVOLUT",
  version: "1.0.0",

  detect(input: StatementInput): ParserDetection {
    const text = decodeStatementText(input.content);
    let table;
    try {
      table = parseDelimited(text, { delimiter: "," });
    } catch {
      return { confidence: 0, reasons: ["unreadable header"] };
    }
    const index = headerIndex(table.header);
    const required = ["type", "started date", "completed date", "amount", "currency", "state"];
    if (!required.every((name) => index.has(name))) {
      return { confidence: 0, reasons: ["missing Revolut columns"] };
    }
    return { confidence: 0.95, reasons: ["Revolut Type/State/Amount columns"] };
  },

  async parse(input: StatementInput): Promise<NormalizedStatement> {
    const text = decodeStatementText(input.content);
    const table = parseDelimited(text, { delimiter: "," });
    const index = headerIndex(table.header);
    const col = (name: string) => index.get(name);

    const rows: NormalizedStatementRow[] = [];
    const warnings: StatementWarning[] = [];
    let lastBalance: string | undefined;

    table.rows.forEach((row, position) => {
      const rowNumber = position + 1;
      const state = cellAt(row, col("state")).toUpperCase();
      if (state && state !== "COMPLETED") {
        warnings.push(skipWarning(rowNumber, "non_completed", `Transaction state is ${state}.`));
        return;
      }

      const bookingDate = normalizeDate(cellAt(row, col("completed date")));
      const currency = normalizeCurrency(cellAt(row, col("currency")));
      const amount = normalizeAmount(cellAt(row, col("amount")));

      if (!bookingDate) {
        warnings.push(skipWarning(rowNumber, "ambiguous_date", "Could not read the completed date."));
        return;
      }
      if (!currency) {
        warnings.push(skipWarning(rowNumber, "ambiguous_currency", "Could not read the currency."));
        return;
      }
      if (amount === null) {
        warnings.push(skipWarning(rowNumber, "ambiguous_amount", "Could not read the amount."));
        return;
      }

      const fee = normalizeAmount(cellAt(row, col("fee")) || "0");
      if (fee !== null && !money(fee).isZero()) {
        warnings.push({
          code: "fee_present",
          message: "Row carries a separate fee that is preserved in the source row but not booked as its own transaction.",
          rowNumber,
        });
      }

      const balance = normalizeAmount(cellAt(row, col("balance")) || "");
      if (balance !== null) lastBalance = balance;

      const type = cleanText(cellAt(row, col("type")));
      const description = cleanText(cellAt(row, col("description"))) ?? type ?? "Revolut transaction";

      rows.push({
        rowNumber,
        bookingDate,
        valueDate: normalizeDate(cellAt(row, col("started date"))) ?? undefined,
        amount,
        currency,
        description,
        counterparty: type,
        balanceAfter: balance ?? undefined,
        originalRow: rowObject(table.header, row.cells),
      });
    });

    return { closingBalance: lastBalance, rows, warnings };
  },
};
