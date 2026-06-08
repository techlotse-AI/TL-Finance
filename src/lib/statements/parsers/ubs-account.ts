import {
  cellAt,
  decodeStatementText,
  headerIndex,
  parseDelimited,
} from "@/lib/statements/csv";
import {
  cleanText,
  extractMaskedAccount,
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
 * UBS account statement CSV (Swiss e-banking export). Semicolon-delimited with
 * separate Debit/Credit columns and a running Balance. Amounts use Swiss number
 * formatting (1'234.56). Debits are stored negative, credits positive.
 */
export const ubsAccountParser: StatementParser = {
  key: "ubs-account",
  institution: "UBS",
  version: "1.0.0",

  detect(input: StatementInput): ParserDetection {
    const text = decodeStatementText(input.content);
    const reasons: string[] = [];
    if (!text.includes(";")) return { confidence: 0, reasons: ["not semicolon-delimited"] };
    let table;
    try {
      table = parseDelimited(text, { delimiter: ";" });
    } catch {
      return { confidence: 0, reasons: ["unreadable header"] };
    }
    const index = headerIndex(table.header);
    const hasBooking = index.has("booking date");
    const hasDebitCredit = index.has("debit") && index.has("credit");
    if (!hasBooking || !hasDebitCredit) {
      return { confidence: 0, reasons: ["missing UBS account columns"] };
    }
    reasons.push("booking date column", "debit/credit columns");
    let confidence = 0.9;
    if (index.has("balance")) {
      confidence = 0.95;
      reasons.push("balance column");
    }
    return { confidence, reasons };
  },

  async parse(input: StatementInput): Promise<NormalizedStatement> {
    const text = decodeStatementText(input.content);
    const table = parseDelimited(text, { delimiter: ";" });
    const index = headerIndex(table.header);
    const col = (name: string) => index.get(name);

    const bookingCol = col("booking date");
    const valueCol = col("value date");
    const currencyCol = col("currency") ?? col("ccy.") ?? col("ccy");
    const debitCol = col("debit");
    const creditCol = col("credit");
    const balanceCol = col("balance");
    const descriptionCols = [col("description1"), col("description"), col("description2"), col("description3")]
      .filter((value): value is number => value !== undefined);

    const rows: NormalizedStatementRow[] = [];
    const warnings: StatementWarning[] = [];
    let lastBalance: string | undefined;

    table.rows.forEach((row, position) => {
      const rowNumber = position + 1;
      const bookingDate = normalizeDate(cellAt(row, bookingCol));
      const currency = normalizeCurrency(cellAt(row, currencyCol));
      const amount = signedFromDebitCredit(cellAt(row, debitCol), cellAt(row, creditCol));

      if (!bookingDate) {
        warnings.push(skipWarning(rowNumber, "ambiguous_date", "Could not read the booking date."));
        return;
      }
      if (!currency) {
        warnings.push(skipWarning(rowNumber, "ambiguous_currency", "Could not read the transaction currency."));
        return;
      }
      if (amount === null) {
        warnings.push(skipWarning(rowNumber, "ambiguous_amount", "Row must have exactly one of debit or credit."));
        return;
      }

      const description = cleanText(descriptionCols.map((c) => cellAt(row, c)).filter(Boolean).join(" — ")) ?? "UBS transaction";
      const balanceAfter = balanceCol !== undefined ? cellAt(row, balanceCol) : "";
      const normalizedBalance = balanceAfter ? signedFromDebitCredit("", balanceAfter) ?? undefined : undefined;
      if (normalizedBalance) lastBalance = normalizedBalance;

      rows.push({
        rowNumber,
        bookingDate,
        valueDate: normalizeDate(cellAt(row, valueCol)) ?? undefined,
        amount,
        currency,
        description,
        balanceAfter: normalizedBalance,
        originalRow: rowObject(table.header, row.cells),
      });
    });

    if (rows.length === 0 && table.rows.length > 0) {
      warnings.push({ code: "no_rows_parsed", message: "No rows could be parsed from this statement." });
    }

    return {
      accountIdentity: extractMaskedAccount(text),
      closingBalance: lastBalance,
      rows,
      warnings,
    };
  },
};
