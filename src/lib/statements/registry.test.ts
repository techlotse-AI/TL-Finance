import { beforeEach, describe, expect, it } from "vitest";

import { clearStatementParsersForTests, detectStatementParser, registerStatementParser } from "@/lib/statements/registry";
import type { StatementParser } from "@/lib/statements/types";

const input = { filename: "statement.csv", content: new Uint8Array([1, 2, 3]) };

function parser(key: string, confidence: number): StatementParser {
  return {
    key, institution: "UNKNOWN", version: "1",
    detect: () => ({ confidence, reasons: [] }),
    parse: async () => ({ rows: [], warnings: [] }),
  };
}

describe("statement parser registry", () => {
  beforeEach(clearStatementParsersForTests);
  it("selects one strongest parser", () => {
    registerStatementParser(parser("weak", 0.4));
    registerStatementParser(parser("strong", 0.9));
    expect(detectStatementParser(input)?.key).toBe("strong");
  });
  it("fails closed on tied detection", () => {
    registerStatementParser(parser("one", 0.8));
    registerStatementParser(parser("two", 0.8));
    expect(detectStatementParser(input)).toBeNull();
  });
});
