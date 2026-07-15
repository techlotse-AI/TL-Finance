import { describe, expect, it } from "vitest";

import { UnsupportedStatementError, unsupportedStatementMessage } from "@/lib/statements/errors";

describe("unsupportedStatementMessage", () => {
  it("lists every parser's top reason, ranked by confidence, when nothing matched", () => {
    const error = new UnsupportedStatementError([
      { parserKey: "generic-csv", institution: "UNKNOWN", detection: { confidence: 0, reasons: ["missing canonical template columns"] } },
      { parserKey: "ubs-account", institution: "UBS", detection: { confidence: 0, reasons: ["not semicolon-delimited"] } },
      { parserKey: "revolut", institution: "REVOLUT", detection: { confidence: 0, reasons: ["missing Revolut columns"] } },
    ]);
    const message = unsupportedStatementMessage(error);
    expect(message).toContain("No production-ready parser recognized this statement.");
    expect(message).toContain("ubs-account (UBS): not semicolon-delimited");
    expect(message).toContain("revolut (REVOLUT): missing Revolut columns");
    expect(message).toContain("generic-csv (UNKNOWN): missing canonical template columns");
  });

  it("reports ambiguity distinctly when two or more parsers tie at the top confidence", () => {
    const error = new UnsupportedStatementError([
      { parserKey: "ubs-account", institution: "UBS", detection: { confidence: 0.9, reasons: ["booking date column"] } },
      { parserKey: "ubs-card", institution: "UBS", detection: { confidence: 0.9, reasons: ["purchase date + sector columns"] } },
      { parserKey: "revolut", institution: "REVOLUT", detection: { confidence: 0, reasons: ["missing Revolut columns"] } },
    ]);
    const message = unsupportedStatementMessage(error);
    expect(message).toContain("Multiple parsers matched this statement with equal confidence");
  });

  it("falls back to a bare headline when there are no registered parsers at all", () => {
    const message = unsupportedStatementMessage(new UnsupportedStatementError([]));
    expect(message).toBe("No production-ready parser recognized this statement.");
  });
});
