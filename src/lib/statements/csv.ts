/**
 * Dependency-free delimited-text parsing for statement ingestion.
 *
 * Statement parsers must not pull in a CSV dependency (see AGENTS.md
 * "Minimize Dependencies"). This module implements a small, strict reader that
 * understands quoted fields, escaped quotes, and a configurable delimiter, and
 * decodes input bytes while stripping a UTF-8 byte-order mark.
 */

export interface DelimitedTable {
  delimiter: string;
  header: string[];
  rows: DelimitedRow[];
}

export interface DelimitedRow {
  /** 1-based line number of the record within the decoded text. */
  lineNumber: number;
  cells: string[];
}

const SUPPORTED_DELIMITERS = [",", ";", "\t"] as const;

export function decodeStatementText(content: Uint8Array): string {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(content);
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Detects the delimiter by counting unquoted delimiter occurrences in the first
 * meaningful line. Returns null when no supported delimiter is present.
 */
export function detectDelimiter(text: string): string | null {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim().length > 0);
  if (!firstLine) return null;

  let best: string | null = null;
  let bestCount = 0;
  for (const delimiter of SUPPORTED_DELIMITERS) {
    const count = countUnquoted(firstLine, delimiter);
    if (count > bestCount) {
      bestCount = count;
      best = delimiter;
    }
  }
  return bestCount > 0 ? best : null;
}

function countUnquoted(line: string, delimiter: string): number {
  let count = 0;
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      count += 1;
    }
  }
  return count;
}

/**
 * Parses delimited text into a header plus records. The first non-empty line is
 * treated as the header. Skips fully blank records. `headerOffset` allows a
 * parser to ignore a leading metadata block.
 */
export function parseDelimited(
  text: string,
  options: { delimiter?: string; headerOffset?: number } = {},
): DelimitedTable {
  const delimiter = options.delimiter ?? detectDelimiter(text);
  if (!delimiter) {
    throw new Error("No supported delimiter (comma, semicolon, or tab) was found.");
  }

  const records = parseRecords(text, delimiter);
  const meaningful = records.filter((record) => record.cells.some((cell) => cell.trim().length > 0));
  const headerIndex = options.headerOffset ?? 0;
  const headerRecord = meaningful[headerIndex];
  if (!headerRecord) {
    throw new Error("The statement does not contain a header row.");
  }

  return {
    delimiter,
    header: headerRecord.cells.map((cell) => cell.trim()),
    rows: meaningful.slice(headerIndex + 1),
  };
}

function parseRecords(text: string, delimiter: string): DelimitedRow[] {
  const records: DelimitedRow[] = [];
  let cells: string[] = [];
  let field = "";
  let inQuotes = false;
  let lineNumber = 1;
  let recordStartLine = 1;
  let started = false;

  const pushField = () => {
    cells.push(field);
    field = "";
  };
  const pushRecord = () => {
    pushField();
    records.push({ lineNumber: recordStartLine, cells });
    cells = [];
    started = false;
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (!started && char !== "\n" && char !== "\r") {
      started = true;
      recordStartLine = lineNumber;
    }

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        if (char === "\n") lineNumber += 1;
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      pushField();
    } else if (char === "\n") {
      if (started) pushRecord();
      lineNumber += 1;
    } else if (char === "\r") {
      // Handled together with the following \n; ignore standalone CR.
      if (text[index + 1] !== "\n" && started) pushRecord();
    } else {
      field += char;
    }
  }

  if (started || field.length > 0 || cells.length > 0) {
    pushRecord();
  }

  return records;
}

/** Builds a case-insensitive header index for tolerant column lookup. */
export function headerIndex(header: string[]): Map<string, number> {
  const map = new Map<string, number>();
  header.forEach((name, index) => {
    const key = name.trim().toLowerCase();
    if (key.length > 0 && !map.has(key)) map.set(key, index);
  });
  return map;
}

export function cellAt(row: DelimitedRow, index: number | undefined): string {
  if (index === undefined || index < 0) return "";
  return (row.cells[index] ?? "").trim();
}
