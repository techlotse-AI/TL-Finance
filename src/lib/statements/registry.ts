import type { StatementInput, StatementParser } from "@/lib/statements/types";

const parsers = new Map<string, StatementParser>();

export function registerStatementParser(parser: StatementParser): void {
  if (parsers.has(parser.key)) throw new Error(`Statement parser "${parser.key}" is already registered.`);
  parsers.set(parser.key, parser);
}

export function listStatementParsers(): StatementParser[] {
  return [...parsers.values()];
}

export function detectStatementParser(input: StatementInput): StatementParser | null {
  const ranked = listStatementParsers()
    .map((parser) => ({ parser, detection: parser.detect(input) }))
    .filter(({ detection }) => detection.confidence > 0)
    .sort((left, right) => right.detection.confidence - left.detection.confidence);

  if (ranked.length === 0) return null;
  if (ranked.length > 1 && ranked[0].detection.confidence === ranked[1].detection.confidence) {
    return null;
  }
  return ranked[0].parser;
}

export function clearStatementParsersForTests(): void {
  parsers.clear();
}
