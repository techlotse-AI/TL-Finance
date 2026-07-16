import { isValidAccountReference, maskAccountReference } from "@/lib/accounts/reference";
import { money } from "@/lib/money/decimal";
import { extractPdfText, looksLikePdf } from "@/lib/statements/pdf";
import { cleanText, normalizeAmount } from "@/lib/statements/parsers/shared";
import type {
  NormalizedStatement,
  NormalizedStatementRow,
  ParserDetection,
  StatementInput,
  StatementParser,
  StatementWarning,
} from "@/lib/statements/types";

/**
 * FNB Private Clients Current Account "Tax Invoice/Statement" PDF.
 *
 * Verified against two real (sanitized-for-fixture) statements from the same
 * account, one month apart — both reconcile exactly: every row's running
 * balance matches the printed Opening/Closing Balance and the credit/debit
 * transaction counts in the "Turnover for Statement Period" summary.
 *
 * Format quirks confirmed from the real files (not assumed):
 * - Transaction dates are "DD Mon" with no year; the year is resolved from
 *   the printed "Statement Period : D Month YYYY to D Month YYYY" line,
 *   which spans at most two calendar months (FNB statements are ~30 days).
 * - Amounts are a bare number for a debit and carry a "Cr" suffix for a
 *   credit — never a minus sign. The running balance always carries a
 *   "Cr"/"Dr" suffix. Thousands separator is a comma, decimal a period.
 * - The trailing "#Monthly Account Fee" row's description text is dropped
 *   by PDF text extraction (observed in both real files, same row every
 *   time — likely a "#"-glyph encoding quirk in FNB's statement font); it
 *   is the only row with an empty description, so an empty description is
 *   filled in as "Monthly Account Fee" rather than left blank.
 * - A row's description can itself contain a "DD Mon"-shaped substring
 *   (e.g. a POS purchase's spend date differs from its posting date) — the
 *   row-boundary split only fires immediately after a completed "Cr"/"Dr"
 *   balance token, never on a bare date-shaped pattern, so this doesn't
 *   cause a false split.
 */

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const STATEMENT_PERIOD = /Statement Period\s*:\s*\d{1,2} (\w+) (\d{4}) to \d{1,2} (\w+) (\d{4})/;
const ACCOUNT_LABEL = /FNB Private Clients Current Acc\s*:\s*(\d{6,20})/;
const OPENING_CLOSING = /Opening Balance\s*([\d,]+\.\d{2})\s?(Cr|Dr)[\s\S]*?Closing Balance\s*([\d,]+\.\d{2})\s?(Cr|Dr)/;
const TABLE_HEADER = "Accrued Bank Charges";
const TABLE_FOOTER = "Closing Balance";
const ROW_SPLIT = /(?<=Cr|Dr) (?=\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b)/;
const ROW_PATTERN = /^(\d{1,2}) (\w{3})\w*\s+(.*?)\s*([\d,]+\.\d{2})\s?(Cr)?\s+([\d,]+\.\d{2})\s?(Cr|Dr)$/;

export interface FnbParsedRow {
  bookingDate: string;
  description: string;
  amount: string;
  balanceAfter: string;
}

export interface FnbParsedStatement {
  accountNumber?: string;
  openingBalance?: string;
  closingBalance?: string;
  rows: FnbParsedRow[];
  warnings: StatementWarning[];
}

function signedBalance(raw: string, suffix: string): string | undefined {
  const amount = normalizeAmount(raw);
  if (amount === null) return undefined;
  return suffix === "Dr" ? money(amount).negated().toFixed(4) : amount;
}

/**
 * Pure text-to-transactions logic, once a PDF's text has been extracted (see
 * pdf.ts). Fully testable without a real PDF file — see
 * fnb-current-account.test.ts, which exercises this against a sanitized
 * fixture shaped exactly like unpdf's real extraction output.
 */
export function parseFnbCurrentAccountText(text: string): FnbParsedStatement {
  const periodMatch = STATEMENT_PERIOD.exec(text);
  if (!periodMatch) {
    return { rows: [], warnings: [{ code: "unrecognized_statement", message: "Could not find the statement period header." }] };
  }
  const [, startMonthName, startYear, endMonthName, endYear] = periodMatch;
  const monthYear = new Map<string, string>([
    [startMonthName.slice(0, 3), startYear],
    [endMonthName.slice(0, 3), endYear],
  ]);

  const accountNumber = ACCOUNT_LABEL.exec(text)?.[1];

  const balancesMatch = OPENING_CLOSING.exec(text);
  const openingBalance = balancesMatch ? signedBalance(balancesMatch[1], balancesMatch[2]) : undefined;
  const closingBalance = balancesMatch ? signedBalance(balancesMatch[3], balancesMatch[4]) : undefined;

  const tableStart = text.indexOf(TABLE_HEADER);
  if (tableStart === -1) {
    return { accountNumber, openingBalance, closingBalance, rows: [], warnings: [{ code: "unrecognized_statement", message: "Could not find the transaction table." }] };
  }
  const afterHeader = text.slice(tableStart + TABLE_HEADER.length);
  const tableEnd = afterHeader.indexOf(TABLE_FOOTER);
  const tableText = (tableEnd === -1 ? afterHeader : afterHeader.slice(0, tableEnd)).trim();

  const warnings: StatementWarning[] = [];
  const rows: FnbParsedRow[] = [];
  const segments = tableText.split(ROW_SPLIT).map((segment) => segment.trim()).filter(Boolean);

  segments.forEach((segment, index) => {
    const rowNumber = index + 1;
    const match = ROW_PATTERN.exec(segment);
    if (!match) {
      warnings.push({ code: "ambiguous_row", message: `Could not read transaction row: "${segment}". Row skipped.`, rowNumber });
      return;
    }
    const [, day, monthAbbr, descriptionRaw, amountRaw, creditSuffix, balanceRaw, balanceSuffix] = match;
    const year = monthYear.get(monthAbbr);
    if (!year) {
      warnings.push({ code: "ambiguous_date", message: `Month "${monthAbbr}" is outside the statement period. Row skipped.`, rowNumber });
      return;
    }
    const amount = normalizeAmount(amountRaw);
    const balance = normalizeAmount(balanceRaw);
    if (amount === null || balance === null) {
      warnings.push({ code: "ambiguous_amount", message: "Could not read the amount or balance. Row skipped.", rowNumber });
      return;
    }
    rows.push({
      bookingDate: `${year}-${String(MONTH_ABBR.indexOf(monthAbbr) + 1).padStart(2, "0")}-${day.padStart(2, "0")}`,
      description: cleanText(descriptionRaw) ?? "Monthly Account Fee",
      amount: creditSuffix ? amount : money(amount).negated().toFixed(4),
      balanceAfter: balanceSuffix === "Dr" ? money(balance).negated().toFixed(4) : balance,
    });
  });

  return { accountNumber, openingBalance, closingBalance, rows, warnings };
}

export const fnbCurrentAccountParser: StatementParser = {
  key: "fnb-current-account",
  institution: "FNB",
  version: "1.0.0",

  detect(input: StatementInput): ParserDetection {
    if (!looksLikePdf(input.content)) {
      return { confidence: 0, reasons: ["not a PDF"] };
    }
    // No other registered parser reads PDF content, so this is unambiguous at
    // detection time; parse() confirms the FNB-specific markers and throws a
    // clear error if this turns out to be some other institution's PDF.
    return { confidence: 0.6, reasons: ["PDF content"] };
  },

  async parse(input: StatementInput): Promise<NormalizedStatement> {
    const text = await extractPdfText(input.content);
    if (!text.includes("FNB Private Clients Current Acc") || !text.includes("Transactions in RAND (ZAR)")) {
      throw new Error("This PDF does not look like an FNB Private Clients Current Account statement.");
    }

    const parsed = parseFnbCurrentAccountText(text);
    const rows: NormalizedStatementRow[] = parsed.rows.map((row, index) => ({
      rowNumber: index + 1,
      bookingDate: row.bookingDate,
      amount: row.amount,
      currency: "ZAR",
      description: row.description,
      balanceAfter: row.balanceAfter,
      originalRow: { bookingDate: row.bookingDate, description: row.description, amount: row.amount, balanceAfter: row.balanceAfter },
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
