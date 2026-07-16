import type { ParserDetection, StatementInput, StatementParser } from "@/lib/statements/types";

const parsers = new Map<string, StatementParser>();

export function registerStatementParser(parser: StatementParser): void {
  if (parsers.has(parser.key)) throw new Error(`Statement parser "${parser.key}" is already registered.`);
  parsers.set(parser.key, parser);
}

export function listStatementParsers(): StatementParser[] {
  return [...parsers.values()];
}

export interface ParserDetectionAttempt {
  parserKey: string;
  institution: string;
  detection: ParserDetection;
}

/** Every registered parser's detection result against this input, ranked highest-confidence first, for actionable "why didn't this match" reporting. */
export function detectStatementParserAttempts(input: StatementInput): ParserDetectionAttempt[] {
  return listStatementParsers()
    .map((parser) => ({ parserKey: parser.key, institution: parser.institution, detection: parser.detect(input) }))
    .sort((left, right) => right.detection.confidence - left.detection.confidence);
}

export function detectStatementParser(input: StatementInput): StatementParser | null {
  const ranked = detectStatementParserAttempts(input).filter(({ detection }) => detection.confidence > 0);

  if (ranked.length === 0) return null;
  if (ranked.length > 1 && ranked[0].detection.confidence === ranked[1].detection.confidence) {
    return null;
  }
  const parser = listStatementParsers().find((candidate) => candidate.key === ranked[0].parserKey);
  return parser ?? null;
}

export function clearStatementParsersForTests(): void {
  parsers.clear();
}
