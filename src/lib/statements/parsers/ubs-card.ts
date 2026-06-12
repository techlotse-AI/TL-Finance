import { cellAt, decodeStatementText, headerIndex, parseDelimited } from "@/lib/statements/csv";
import {
  cleanText,
  extractMaskedAccount,
  extractUniqueAccountMatchReference,
  normalizeCurrency,
  normalizeDate,
  rowObject,
  signedFromDebitCredit,
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
 * UBS credit-card statement CSV. Semicolon-delimited with a Purchase date,
 * Sector classification, and separate Debit/Credit columns. Purchases are
 * stored negative; payments and refunds positive.
 */
export const ubsCardParser: StatementParser = {
  key: "ubs-card",
  institution: "UBS",
  version: "1.0.0",

  detect(input: StatementInput): ParserDetection {
    const text = decodeStatementText(input.content);
    if (!text.includes(";")) return { confidence: 0, reasons: ["not semicolon-delimited"] };
    let table;
    try {
      table = parseDelimited(text, { delimiter: ";" });
    } catch {
      return { confidence: 0, reasons: ["unreadable header"] };
    }
    const index = headerIndex(table.header);
    if (!index.has("purchase date") || !index.has("sector")) {
      return { confidence: 0, reasons: ["missing UBS card columns"] };
    }
    return { confidence: 0.9, reasons: ["purchase date + sector columns"] };
  },

  async parse(input: StatementInput): Promise<NormalizedStatement> {
    const text = decodeStatementText(input.content);
    const table = parseDelimited(text, { delimiter: ";" });
    const index = headerIndex(table.header);
    const col = (name: string) => index.get(name);

    const rows: NormalizedStatementRow[] = [];
    const warnings: StatementWarning[] = [];
    const accountReferenceCol =
      col("card number") ?? col("card_number") ?? col("account number") ??
      col("account_number") ?? col("iban");

    table.rows.forEach((row, position) => {
      const rowNumber = position + 1;
      const bookingDate = normalizeDate(cellAt(row, col("purchase date")));
      const currency = normalizeCurrency(cellAt(row, col("currency")));
      const amount = signedFromDebitCredit(cellAt(row, col("debit")), cellAt(row, col("credit")));

      if (!bookingDate) {
        warnings.push(skipWarning(rowNumber, "ambiguous_date", "Could not read the purchase date."));
        return;
      }
      if (!currency) {
        warnings.push(skipWarning(rowNumber, "ambiguous_currency", "Could not read the currency."));
        return;
      }
      if (amount === null) {
        warnings.push(skipWarning(rowNumber, "ambiguous_amount", "Row must have exactly one of debit or credit."));
        return;
      }

      const sector = cleanText(cellAt(row, col("sector")));
      const bookingText = cleanText(cellAt(row, col("booking text")));
      rows.push({
        rowNumber,
        bookingDate,
        amount,
        currency,
        description: bookingText ?? sector ?? "UBS card transaction",
        counterparty: sector,
        originalRow: rowObject(table.header, row.cells),
      });
    });

    return {
      accountIdentity: extractMaskedAccount(text),
      accountMatchReference: extractUniqueAccountMatchReference(
        table.rows.map((row) => cellAt(row, accountReferenceCol)),
      ),
      rows,
      warnings,
    };
  },
};
