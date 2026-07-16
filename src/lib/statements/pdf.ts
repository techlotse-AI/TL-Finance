/**
 * PDF text extraction (v0.9.5). The only place in the statement-ingestion
 * pipeline that depends on a PDF library — every non-text source format
 * elsewhere (csv.ts, ofx.ts) is dependency-free per AGENTS.md's locked stack,
 * but there is no dependency-free way to read a PDF's content stream, so this
 * is a deliberate, documented exception (see AGENTS.md Stack). `unpdf` wraps
 * PDF.js for serverless/Node runtimes with no native binaries and no required
 * dependencies of its own.
 *
 * Keep this module thin: PDF parsers should extract text here, then do all
 * real parsing logic against that text in a pure, fixture-testable function
 * (see parsers/fnb-current-account.ts), exactly like ofx.ts's tag/value
 * reader operates on already-decoded text rather than raw bytes.
 */

import { extractText, getDocumentProxy } from "unpdf";

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

/** Cheap, synchronous PDF sniff via the standard header magic bytes, for StatementParser.detect() (which cannot await extraction). */
export function looksLikePdf(content: Uint8Array): boolean {
  return PDF_MAGIC.every((byte, index) => content[index] === byte);
}

/** Extracts all pages' text, merged into one string in reading order. */
export async function extractPdfText(content: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(content);
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}
