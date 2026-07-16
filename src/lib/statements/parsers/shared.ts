/**
 * Shared, fail-closed normalization helpers for statement parsers.
 *
 * Parsers must never guess. When a date, sign, currency, or amount is
 * ambiguous, these helpers return null so the caller can emit a structured
 * warning and skip the row rather than inventing data.
 */

import { money } from "@/lib/money/decimal";
import { isValidAccountReference, maskAccountReference } from "@/lib/accounts/reference";
import type { StatementWarning } from "@/lib/statements/types";

/** Builds a structured "row skipped" warning for a fail-closed condition. */
export function skipWarning(rowNumber: number, code: string, message: string): StatementWarning {
  return { code, message: `${message} Row skipped.`, rowNumber };
}

/** Captures the original source cells keyed by header for audit/source preservation. */
export function rowObject(header: string[], cells: string[]): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  header.forEach((name, index) => {
    if (name) record[name] = cells[index] ?? "";
  });
  return record;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;
const ISO_SLASH_DATE = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/;
const SWISS_DATE = /^(\d{1,2})[.](\d{1,2})[.](\d{2,4})$/;
const SLASH_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/;

/** Returns an ISO `YYYY-MM-DD` string or null when the input cannot be parsed unambiguously. */
export function normalizeDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  const iso = ISO_DATE.exec(value);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // Year-first with slashes (e.g. FNB's "2026/07/15") is unambiguous — check
  // before the day/month-first SLASH_DATE below.
  const isoSlash = ISO_SLASH_DATE.exec(value);
  if (isoSlash) return composeDate(isoSlash[1], isoSlash[2], isoSlash[3]);

  const swiss = SWISS_DATE.exec(value);
  if (swiss) return composeDate(swiss[3], swiss[2], swiss[1]);

  const slash = SLASH_DATE.exec(value);
  if (slash) return composeDate(slash[3], slash[2], slash[1]);

  return null;
}

function composeDate(year: string, month: string, day: string): string | null {
  const fullYear = year.length === 2 ? `20${year}` : year.padStart(4, "0");
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  if (monthNumber < 1 || monthNumber > 12 || dayNumber < 1 || dayNumber > 31) return null;
  const composed = `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const parsed = new Date(`${composed}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  // Reject impossible calendar dates such as 2026-02-31.
  if (parsed.getUTCDate() !== dayNumber || parsed.getUTCMonth() + 1 !== monthNumber) return null;
  return composed;
}

/**
 * Parses a Swiss/European formatted amount. Handles apostrophe thousands
 * separators (1'234.56), space separators, and comma decimals (1.234,56).
 * Returns a normalized decimal string or null when unparseable.
 */
export function normalizeAmount(raw: string): string | null {
  let value = raw.trim();
  if (!value) return null;

  const negativeParens = /^\((.*)\)$/.exec(value);
  let sign = "";
  if (negativeParens) {
    sign = "-";
    value = negativeParens[1].trim();
  }

  value = value.replace(/[A-Za-z\s']/g, "").replace(/[ ’]/g, "");

  const hasComma = value.includes(",");
  const hasDot = value.includes(".");
  if (hasComma && hasDot) {
    // The right-most separator is the decimal separator.
    if (value.lastIndexOf(",") > value.lastIndexOf(".")) {
      value = value.replace(/\./g, "").replace(",", ".");
    } else {
      value = value.replace(/,/g, "");
    }
  } else if (hasComma) {
    // A lone comma is treated as the decimal separator.
    value = value.replace(",", ".");
  }

  if (value === "" || value === "-" || value === "+") return null;
  if (!/^[-+]?\d+(\.\d+)?$/.test(value)) return null;

  try {
    return money(`${sign}${value}`).toFixed(4);
  } catch {
    return null;
  }
}

const CURRENCY = /^[A-Za-z]{3}$/;

/** Normalizes an ISO-4217 currency code or returns null. */
export function normalizeCurrency(raw: string): string | null {
  const value = raw.trim().toUpperCase();
  return CURRENCY.test(value) ? value : null;
}

/** Collapses whitespace and trims; returns undefined for empty strings. */
export function cleanText(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const value = raw.trim().replace(/\s+/g, " ");
  return value.length > 0 ? value : undefined;
}

const IBAN = /\b([A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){10,30})\b/;

/**
 * Extracts and masks an account identifier (IBAN or long account number) from
 * raw statement text. Returns a masked form keeping only the last four
 * characters so raw account identity is never persisted in cleartext.
 */
export function extractMaskedAccount(text: string): string | undefined {
  const iban = IBAN.exec(text.toUpperCase());
  if (iban) return maskAccountReference(iban[1]);
  const account = /\b(\d[\d.\-]{6,})\b/.exec(text);
  if (account) return maskAccountReference(account[1]);
  return undefined;
}

/**
 * Returns a matchable masked account reference only when a dedicated statement
 * account column contains one consistent valid identifier. Transaction text
 * and counterparty fields must never be used for account suggestions.
 */
export function extractUniqueAccountMatchReference(values: string[]): string | undefined {
  const references = new Set(
    values
      .map((value) => value.trim())
      .filter((value) => value.length > 0 && isValidAccountReference(value))
      .map(maskAccountReference),
  );
  return references.size === 1 ? [...references][0] : undefined;
}

/**
 * Resolves a single signed amount from separate debit and credit columns.
 * Debits are stored as negative, credits as positive. Returns null when both or
 * neither are present (ambiguous) and the caller should warn.
 */
export function signedFromDebitCredit(
  debitRaw: string,
  creditRaw: string,
): string | null {
  const debit = debitRaw.trim() ? normalizeAmount(debitRaw) : null;
  const credit = creditRaw.trim() ? normalizeAmount(creditRaw) : null;

  if (debit !== null && credit !== null) return null;
  if (debit !== null) return money(debit).abs().negated().toFixed(4);
  if (credit !== null) return money(credit).abs().toFixed(4);
  return null;
}
