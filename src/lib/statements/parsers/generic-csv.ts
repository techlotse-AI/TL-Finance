import { cellAt, decodeStatementText, headerIndex, parseDelimited } from "@/lib/statements/csv";
import {
  cleanText,
  extractUniqueAccountMatchReference,
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
 * Generic TL Finance CSV template. Lets households import any institution by
 * mapping to an explicit canonical header: date, amount, currency, description,
 * and optional counterparty, reference, and balance. Amount is pre-signed
 * (negative for outgoing). Detection confidence is deliberately low so a
 * specific institution parser always wins when both match.
 */
export const genericCsvParser: StatementParser = {
  key: "generic-csv",
  institution: "UNKNOWN",
  version: "1.0.0",

  detect(input: StatementInput): ParserDetection {
    const text = decodeStatementText(input.content);
    let table;
    try {
      table = parseDelimited(text);
    } catch {
      return { confidence: 0, reasons: ["no delimiter"] };
    }
    const index = headerIndex(table.header);
    const required = ["date", "amount", "currency", "description"];
    if (!required.every((name) => index.has(name))) {
      return { confidence: 0, reasons: ["missing canonical template columns"] };
    }
    return { confidence: 0.5, reasons: ["canonical date/amount/currency/description columns"] };
  },

  async parse(input: StatementInput): Promise<NormalizedStatement> {
    const text = decodeStatementText(input.content);
    const table = parseDelimited(text);
    const index = headerIndex(table.header);
    const col = (name: string) => index.get(name);

    const rows: NormalizedStatementRow[] = [];
    const warnings: StatementWarning[] = [];
    const accountReferenceCol =
      col("account iban") ?? col("account_iban") ?? col("iban") ??
      col("account number") ?? col("account_number");

    table.rows.forEach((row, position) => {
      const rowNumber = position + 1;
      const bookingDate = normalizeDate(cellAt(row, col("date")));
      const currency = normalizeCurrency(cellAt(row, col("currency")));
      const amount = normalizeAmount(cellAt(row, col("amount")));
      const description = cleanText(cellAt(row, col("description")));

      if (!bookingDate) {
        warnings.push(skipWarning(rowNumber, "ambiguous_date", "Could not read the date (expected YYYY-MM-DD)."));
        return;
      }
      if (!currency) {
        warnings.push(skipWarning(rowNumber, "ambiguous_currency", "Could not read the currency."));
        return;
      }
      if (amount === null) {
        warnings.push(skipWarning(rowNumber, "ambiguous_amount", "Could not read the signed amount."));
        return;
      }
      if (!description) {
        warnings.push(skipWarning(rowNumber, "missing_description", "Description is required."));
        return;
      }

      rows.push({
        rowNumber,
        bookingDate,
        valueDate: normalizeDate(cellAt(row, col("value date"))) ?? undefined,
        amount,
        currency,
        description,
        counterparty: cleanText(cellAt(row, col("counterparty"))),
        reference: cleanText(cellAt(row, col("reference"))),
        balanceAfter: normalizeAmount(cellAt(row, col("balance")) || "") ?? undefined,
        originalRow: rowObject(table.header, row.cells),
      });
    });

    return {
      accountMatchReference: extractUniqueAccountMatchReference(
        table.rows.map((row) => cellAt(row, accountReferenceCol)),
      ),
      rows,
      warnings,
    };
  },
};
