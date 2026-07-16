import type { ParserDetectionAttempt } from "@/lib/statements/registry";

/**
 * Thrown when no registered parser can unambiguously recognize a statement.
 * Carries every parser's detection attempt (confidence + reasons) so callers
 * can build an actionable message instead of a generic "not recognized".
 */
export class UnsupportedStatementError extends Error {
  readonly attempts: ParserDetectionAttempt[];

  constructor(attempts: ParserDetectionAttempt[]) {
    super("No statement parser could be selected with unambiguous confidence.");
    this.name = "UnsupportedStatementError";
    this.attempts = attempts;
  }
}

/** Builds an actionable "why didn't this match" message from every parser's detection attempt. */
export function unsupportedStatementMessage(error: UnsupportedStatementError): string {
  const tried = [...error.attempts]
    .sort((left, right) => right.detection.confidence - left.detection.confidence)
    .map((attempt) => {
      const reason = attempt.detection.reasons[0] ?? "no match";
      return `${attempt.parserKey} (${attempt.institution}): ${reason}`;
    })
    .join("; ");
  const ambiguous = error.attempts.filter((attempt) => attempt.detection.confidence > 0).length > 1;
  const headline = ambiguous
    ? "Multiple parsers matched this statement with equal confidence, so none was selected."
    : "No production-ready parser recognized this statement.";
  return tried ? `${headline} Tried: ${tried}.` : headline;
}
