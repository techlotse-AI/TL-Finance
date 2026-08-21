import { isValidAccountReference, maskAccountReference } from "@/lib/accounts/reference";
import { money } from "@/lib/money/decimal";
import { extractPdfText, looksLikePdf } from "@/lib/statements/pdf";
import { cleanText, normalizeAmount, normalizeCurrency, normalizeDate } from "@/lib/statements/parsers/shared";
import type {
  NormalizedStatement,
  NormalizedStatementRow,
  ParserDetection,
  StatementInput,
  StatementParser,
  StatementWarning,
} from "@/lib/statements/types";

/**
 * Investec Corporate Cash Manager (CCM) "Account statement / Tax invoice" PDF.
 *
 * Verified against eight real (sanitized-for-fixture) monthly statements from
 * the same CCM Call Account — every one reconciles exactly: each row's
 * running balance chains from the printed Opening balance to the printed
 * Closing balance.
 *
 * Format quirks confirmed from the real files (not assumed):
 * - Investec emails these PDFs password-protected. An encrypted PDF cannot be
 *   detected (its metadata is encrypted too) or parsed — pdf.ts surfaces a
 *   clear "password-protected" error; the user must decrypt or download an
 *   unprotected copy first.
 * - Decrypted/portal PDFs carry Investec's statement generator in the
 *   uncompressed document metadata (`/Creator` = "DocFusion", stored as
 *   UTF-16BE hex). That is the only synchronous, byte-level signal that
 *   distinguishes this PDF from FNB's at detect() time, so detection keys on
 *   it and outranks FNB's blanket PDF claim (0.7 vs 0.6, never a tie — the
 *   registry treats ties as no detection).
 * - The Debit and Credit columns collapse into one number stream in text
 *   extraction, so a row's sign is NOT recoverable from the row alone. Every
 *   row prints a running balance ("263.43CR"), so the sign is derived by
 *   chaining: previous balance + amount = row balance → credit; − → debit.
 *   A row whose amount fits neither direction is skipped with a structured
 *   warning, and the chain resumes from that row's printed balance.
 * - A row's description can itself contain amount-shaped numbers (the real
 *   "Intermediary Admin fee (excl. Vat) Admin Fee 2.00 incl. Vat" row) — the
 *   row pattern anchors on the trailing `<amount> <balance>CR|DR` pair, so
 *   only the last two numbers are read as money.
 * - The Opening/Closing balance rows carry no CR/DR suffix; transaction-row
 *   balances always do. All eight real statements print positive (CR)
 *   balances — a DR (overdrawn) balance is handled but never observed.
 * - Dates are dd/mm/yyyy on rows (posted + value date); the currency comes
 *   from the header's "Currency ZAR" field rather than being assumed, since
 *   CCM accounts exist in other denominations.
 */

const CCM_MARKER = "Corporate Cash Manager";
/** "DocFusion" as UTF-16BE hex — Investec's statement generator, present uncompressed in the PDF's /Creator metadata. */
const CREATOR_MARKER_HEX = "0044006f00630046007500730069006f006e";
const CREATOR_MARKER_ASCII = "docfusion";

const ACCOUNT_NUMBER = /Electronic account number (\d{6,20}) /;
const CURRENCY_FIELD = /Currency ([A-Z]{3}) /;
const TABLE_HEADER = "Posted date Value date Description Debit Credit Balance";
const OPENING = /(\d{2}\/\d{2}\/\d{4}) Opening balance ([\d,]+\.\d{2})/;
const CLOSING = /(\d{2}\/\d{2}\/\d{4}) Closing balance ([\d,]+\.\d{2})/;
/** Split immediately after a completed CR/DR balance token, before the next "posted value" date pair. */
const ROW_SPLIT = /(?<=CR|DR) (?=\d{2}\/\d{2}\/\d{4} \d{2}\/\d{2}\/\d{4} )/;
const ROW_PATTERN = /^(\d{2}\/\d{2}\/\d{4}) (\d{2}\/\d{2}\/\d{4}) (.+?) ([\d,]+\.\d{2}) ([\d,]+\.\d{2})(CR|DR)$/;

export interface InvestecParsedRow {
  bookingDate: string;
  valueDate: string;
  description: string;
  /** Signed: negative for a debit, positive for a credit (derived from the balance chain). */
  amount: string;
  balanceAfter: string;
}

export interface InvestecParsedStatement {
  accountNumber?: string;
  currency?: string;
  openingBalance?: string;
  closingBalance?: string;
  rows: InvestecParsedRow[];
  warnings: StatementWarning[];
}

/**
 * Pure text-to-transactions logic, once a PDF's text has been extracted (see
 * pdf.ts). Fully testable without a real PDF file — see investec-ccm.test.ts,
 * which exercises this against sanitized fixtures shaped exactly like unpdf's
 * real extraction output.
 */
export function parseInvestecCcmText(text: string): InvestecParsedStatement {
  const warnings: StatementWarning[] = [];

  const accountNumber = ACCOUNT_NUMBER.exec(text)?.[1];
  const currencyRaw = CURRENCY_FIELD.exec(text)?.[1];
  const currency = currencyRaw ? (normalizeCurrency(currencyRaw) ?? undefined) : undefined;
  if (!currency) {
    return { accountNumber, rows: [], warnings: [{ code: "unrecognized_statement", message: "Could not find the statement's Currency field." }] };
  }

  const tableStart = text.indexOf(TABLE_HEADER);
  if (tableStart === -1) {
    return { accountNumber, currency, rows: [], warnings: [{ code: "unrecognized_statement", message: "Could not find the transaction table." }] };
  }
  const tableText = text.slice(tableStart + TABLE_HEADER.length);

  const openingMatch = OPENING.exec(tableText);
  const closingMatch = CLOSING.exec(tableText);
  const openingBalance = openingMatch ? normalizeAmount(openingMatch[2]) ?? undefined : undefined;
  const closingBalance = closingMatch ? normalizeAmount(closingMatch[2]) ?? undefined : undefined;
  if (openingBalance === undefined) {
    warnings.push({ code: "missing_opening_balance", message: "Could not find the Opening balance row; row signs cannot be derived from the balance chain." });
  }

  const rowsStart = openingMatch ? openingMatch.index + openingMatch[0].length : 0;
  const rowsEnd = closingMatch ? closingMatch.index : tableText.length;
  const rowsText = tableText.slice(rowsStart, rowsEnd).trim();

  const rows: InvestecParsedRow[] = [];
  // All eight real statements print CR (positive) balances throughout; a DR
  // opening would already have failed the chain below and warned, fail-closed.
  let previousBalance = openingBalance ?? null;

  const segments = rowsText ? rowsText.split(ROW_SPLIT).map((segment) => segment.trim()).filter(Boolean) : [];
  segments.forEach((segment, index) => {
    const rowNumber = index + 1;
    const match = ROW_PATTERN.exec(segment);
    if (!match) {
      warnings.push({ code: "ambiguous_row", message: `Could not read transaction row: "${segment}". Row skipped.`, rowNumber });
      return;
    }
    const [, postedRaw, valueRaw, descriptionRaw, amountRaw, balanceRaw, balanceSuffix] = match;
    const bookingDate = normalizeDate(postedRaw);
    const valueDate = normalizeDate(valueRaw);
    const amount = normalizeAmount(amountRaw);
    const balanceUnsigned = normalizeAmount(balanceRaw);
    if (!bookingDate || !valueDate || amount === null || balanceUnsigned === null) {
      warnings.push({ code: "ambiguous_row", message: "Could not read the row's dates or amounts. Row skipped.", rowNumber });
      return;
    }
    const balanceAfter = balanceSuffix === "DR" ? money(balanceUnsigned).negated().toFixed(4) : balanceUnsigned;

    // Debit and Credit columns collapse in extraction — derive the sign from
    // the running balance instead of guessing.
    let signedAmount: string | null = null;
    if (previousBalance !== null) {
      if (money(previousBalance).plus(amount).equals(money(balanceAfter))) signedAmount = amount;
      else if (money(previousBalance).minus(amount).equals(money(balanceAfter))) signedAmount = money(amount).negated().toFixed(4);
    }
    previousBalance = balanceAfter;
    if (signedAmount === null) {
      warnings.push({ code: "ambiguous_sign", message: "The amount does not reconcile against the running balance in either direction. Row skipped.", rowNumber });
      return;
    }

    rows.push({
      bookingDate,
      valueDate,
      description: cleanText(descriptionRaw) ?? "",
      amount: signedAmount,
      balanceAfter,
    });
  });

  if (closingBalance !== undefined && previousBalance !== null && !money(previousBalance).equals(money(closingBalance))) {
    warnings.push({ code: "unreconciled_balance", message: `The final running balance (${previousBalance}) does not match the printed Closing balance (${closingBalance}).` });
  }

  return { accountNumber, currency, openingBalance, closingBalance, rows, warnings };
}

/** Case-insensitive raw-byte sniff for the DocFusion creator marker (detect() cannot await text extraction). */
function hasInvestecCreatorMarker(content: Uint8Array): boolean {
  let source = "";
  for (let index = 0; index < content.length; index += 1) source += String.fromCharCode(content[index]);
  const lowered = source.toLowerCase();
  return lowered.includes(CREATOR_MARKER_HEX) || lowered.includes(CREATOR_MARKER_ASCII);
}

export const investecCcmParser: StatementParser = {
  key: "investec-ccm",
  institution: "INVESTEC",
  version: "1.0.0",

  detect(input: StatementInput): ParserDetection {
    if (!looksLikePdf(input.content)) {
      return { confidence: 0, reasons: ["not a PDF"] };
    }
    if (!hasInvestecCreatorMarker(input.content)) {
      return { confidence: 0, reasons: ["PDF without Investec's statement-generator metadata marker"] };
    }
    // Outranks the FNB PDF parser's blanket 0.6 so two PDF parsers never tie;
    // parse() still confirms the CCM-specific markers and throws a clear
    // error if some other DocFusion-generated PDF lands here.
    return { confidence: 0.7, reasons: ["PDF with Investec's statement-generator metadata marker"] };
  },

  async parse(input: StatementInput): Promise<NormalizedStatement> {
    const text = await extractPdfText(input.content);
    if (!text.includes(CCM_MARKER) || !text.includes("Investec")) {
      throw new Error("This PDF does not look like an Investec Corporate Cash Manager account statement.");
    }

    const parsed = parseInvestecCcmText(text);
    const rows: NormalizedStatementRow[] = parsed.rows.map((row, index) => ({
      rowNumber: index + 1,
      bookingDate: row.bookingDate,
      valueDate: row.valueDate,
      amount: row.amount,
      currency: parsed.currency ?? "ZAR",
      description: row.description,
      balanceAfter: row.balanceAfter,
      originalRow: {
        bookingDate: row.bookingDate,
        valueDate: row.valueDate,
        description: row.description,
        amount: row.amount,
        balanceAfter: row.balanceAfter,
      },
    }));

    const accountReference = parsed.accountNumber && isValidAccountReference(parsed.accountNumber)
      ? maskAccountReference(parsed.accountNumber)
      : undefined;

    return {
      accountIdentity: accountReference,
      accountMatchReference: accountReference,
      openingBalance: parsed.openingBalance,
      closingBalance: parsed.closingBalance,
      rows,
      warnings: parsed.warnings,
    };
  },
};
