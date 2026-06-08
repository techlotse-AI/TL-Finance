/**
 * Deterministic text normalization for allocation rules and subscription
 * detection. Produces a stable merchant key from free-text description and
 * counterparty fields without any AI or fuzzy heuristics.
 */

const DIACRITICS = /[̀-ͯ]/g;
const NOISE = /\b(card|payment|purchase|pos|debit|credit|transaction|ref|reference|no|nr|iban|tx)\b/g;

export function normalizeMerchantKey(description: string, counterparty?: string): string {
  const base = `${counterparty ?? ""} ${description ?? ""}`
    .toLowerCase()
    .normalize("NFKD")
    .replace(DIACRITICS, "")
    .replace(/[0-9]+/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(NOISE, " ")
    .replace(/\s+/g, " ")
    .trim();
  return base.slice(0, 60);
}

export function normalizePattern(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(DIACRITICS, "")
    .replace(/\s+/g, " ")
    .trim();
}
