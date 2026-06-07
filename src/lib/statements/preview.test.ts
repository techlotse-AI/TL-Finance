import { beforeEach, describe, expect, it } from "vitest";

import { previewStatement } from "@/lib/statements/preview";
import { clearStatementParsersForTests, registerStatementParser } from "@/lib/statements/registry";

describe("statement preview", () => {
  beforeEach(clearStatementParsersForTests);
  it("parses without writing transactions and attaches deterministic hashes", async () => {
    registerStatementParser({
      key: "fixture", institution: "UBS", version: "1",
      detect: () => ({ confidence: 1, reasons: ["fixture"] }),
      parse: async () => ({
        accountIdentity: "masked", warnings: [],
        rows: [{ rowNumber: 1, bookingDate: "2026-01-01", amount: "-1.0000", currency: "CHF", description: "Fee", originalRow: { value: "fee" } }],
      }),
    });
    const result = await previewStatement({ filename: "fixture.csv", content: new Uint8Array([1]) });
    expect(result).toMatchObject({ parserKey: "fixture", institution: "UBS" });
    expect(result.rows[0].dedupeHash).toHaveLength(64);
  });
});
