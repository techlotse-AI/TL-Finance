/**
 * Dependency-free OFX (Open Financial Exchange) reading (v0.9.5 groundwork).
 *
 * OFX ships in two dialects: OFX 1.x SGML (a colon-separated header block,
 * then tags like `<TRNTYPE>DEBIT` with no closing tag — the value runs to the
 * next `<`) and OFX 2.x XML (an XML declaration, then properly closed tags
 * like `<TRNTYPE>DEBIT</TRNTYPE>`). Statement parsers must not pull in an
 * XML/SGML dependency (see AGENTS.md "Minimize Dependencies"), so this is a
 * small, tolerant tag/value reader rather than a full parser — it only reads
 * the `<STMTTRN>` transaction blocks and the handful of tags this app needs.
 *
 * A single regex handles both dialects: `<TAG>value` where `value` runs until
 * the next `<`. In SGML that `<` is the following sibling tag; in XML it's the
 * matching `</TAG>` closing tag. Neither dialect's closing tags (`</TAG>`)
 * match the tag-name group, since it starts with `/`, so they're naturally
 * skipped rather than misread as data tags.
 *
 * No real-world FNB (or other institution) OFX export has been validated
 * against this yet — it implements the public OFX spec's transaction shape,
 * not any specific bank's dialect quirks. Treat it as infrastructure, not a
 * production-ready parser, until real sanitized fixtures are available.
 */

const TAG_VALUE = /<([A-Za-z0-9._]+)>([^<]*)/g;

export interface OfxTransaction {
  /** Raw TRNTYPE, e.g. "DEBIT", "CREDIT", "XFER", "FEE". */
  type?: string;
  /** ISO YYYY-MM-DD, from DTPOSTED (falls back to DTUSER). */
  datePosted: string | null;
  /** Raw TRNAMT string, sign-preserved as OFX encodes it. */
  amount: string | null;
  fitId?: string;
  name?: string;
  memo?: string;
  checkNumber?: string;
  /** Per-transaction CURRENCY/ORIGCURRENCY tag, if present (statement-level CURDEF is the usual source instead). */
  currency?: string;
}

export interface OfxStatement {
  /** CURDEF: the statement's default currency, applied to transactions with no per-row currency tag. */
  defaultCurrency?: string;
  /** ACCTID, when present. */
  accountId?: string;
  transactions: OfxTransaction[];
}

/** Cheap format sniff: true when the text looks like OFX 1.x SGML or OFX 2.x XML, before attempting a full read. */
export function looksLikeOfx(text: string): boolean {
  const head = text.slice(0, 400);
  return /OFXHEADER:\s*\d+/i.test(head) || /<\?OFX/i.test(head) || /<OFX>/i.test(text);
}

function ofxDateToIso(raw: string | undefined): string | null {
  if (!raw) return null;
  const digits = raw.trim().slice(0, 8);
  if (!/^\d{8}$/.test(digits)) return null;
  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);
  return `${year}-${month}-${day}`;
}

function tagValues(block: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const match of block.matchAll(TAG_VALUE)) {
    const [, tag, value] = match;
    const trimmed = value.trim();
    if (trimmed.length > 0 && !values.has(tag.toUpperCase())) {
      values.set(tag.toUpperCase(), trimmed);
    }
  }
  return values;
}

/**
 * Reads every `<STMTTRN>...</STMTTRN>` block and the statement-level CURDEF /
 * ACCTID. Malformed or unrecognized content yields an empty transaction list
 * rather than throwing — callers decide whether that means "not OFX" via
 * {@link looksLikeOfx} first.
 */
export function parseOfx(text: string): OfxStatement {
  const headValues = tagValues(text.split(/<STMTTRN>/i)[0] ?? "");
  const defaultCurrency = headValues.get("CURDEF");
  const accountId = headValues.get("ACCTID");

  const transactions: OfxTransaction[] = [];
  const blockPattern = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  for (const match of text.matchAll(blockPattern)) {
    const values = tagValues(match[1]);
    transactions.push({
      type: values.get("TRNTYPE"),
      datePosted: ofxDateToIso(values.get("DTPOSTED") ?? values.get("DTUSER")),
      amount: values.get("TRNAMT") ?? null,
      fitId: values.get("FITID"),
      name: values.get("NAME") ?? values.get("PAYEE"),
      memo: values.get("MEMO"),
      checkNumber: values.get("CHECKNUM"),
      currency: values.get("CURRENCY") ?? values.get("ORIGCURRENCY"),
    });
  }

  return { defaultCurrency, accountId, transactions };
}
