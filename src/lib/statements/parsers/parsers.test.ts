import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import { ensureParsersRegistered } from "@/lib/statements/parsers";
import { previewStatement } from "@/lib/statements/preview";
import { detectStatementParser } from "@/lib/statements/registry";

function fixtureBytes(name: string): Uint8Array {
  return new Uint8Array(readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url))));
}

function preview(name: string) {
  return previewStatement({ filename: name, content: fixtureBytes(name) });
}

beforeAll(() => {
  ensureParsersRegistered();
});

describe("UBS account parser", () => {
  it("parses credits and debits with Swiss formatting", async () => {
    const result = await preview("ubs-account-1.csv");
    expect(result.parserKey).toBe("ubs-account");
    expect(result.institution).toBe("UBS");
    expect(result.rows).toHaveLength(5);
    expect(result.rows[0].amount).toBe("5200.0000");
    expect(result.rows[0].currency).toBe("CHF");
    expect(result.rows[1].amount).toBe("-1850.0000");
    expect(result.warnings).toHaveLength(0);
    expect(result.accountIdentity).toMatch(/2957$/);
    expect(result.closingBalance).toBe("8190.5000");
  });

  it("fails closed on rows with both debit and credit", async () => {
    const result = await preview("ubs-account-2.csv");
    expect(result.rows).toHaveLength(3);
    expect(result.warnings.map((warning) => warning.code)).toContain("ambiguous_amount");
  });
});

describe("UBS card parser", () => {
  it("treats purchases as negative and refunds as positive", async () => {
    const result = await preview("ubs-card-1.csv");
    expect(result.parserKey).toBe("ubs-card");
    expect(result.rows).toHaveLength(4);
    expect(result.rows[0].amount).toBe("-42.0000");
    expect(result.rows[3].amount).toBe("30.0000");
  });
});

describe("Revolut parser", () => {
  it("imports completed rows, skips pending, and flags fees", async () => {
    const result = await preview("revolut-1.csv");
    expect(result.parserKey).toBe("revolut");
    expect(result.rows).toHaveLength(4);
    expect(result.rows[0].amount).toBe("-4.5000");
    const codes = result.warnings.map((warning) => warning.code);
    expect(codes).toContain("non_completed");
    expect(codes).toContain("fee_present");
  });
});

describe("Generic CSV template", () => {
  it("parses a canonical signed-amount export", async () => {
    const result = await preview("generic-1.csv");
    expect(result.parserKey).toBe("generic-csv");
    expect(result.institution).toBe("UNKNOWN");
    expect(result.rows).toHaveLength(3);
    expect(result.warnings).toHaveLength(1);
    expect(result.rows[0].amount).toBe("-1200.0000");
  });

  it("accepts the minimal required column set", async () => {
    const result = await preview("generic-2.csv");
    expect(result.rows).toHaveLength(3);
  });
});

describe("detection and dedupe", () => {
  it("prefers specific institution parsers over the generic template", () => {
    const ubs = detectStatementParser({ filename: "a.csv", content: fixtureBytes("ubs-account-1.csv") });
    expect(ubs?.key).toBe("ubs-account");
    const generic = detectStatementParser({ filename: "b.csv", content: fixtureBytes("generic-1.csv") });
    expect(generic?.key).toBe("generic-csv");
  });

  it("returns no parser for unrecognized content", () => {
    const content = new TextEncoder().encode("this is not a statement at all\njust prose\n");
    expect(detectStatementParser({ filename: "x.txt", content })).toBeNull();
  });

  it("produces a stable, unique dedupe hash per row", async () => {
    const first = await preview("ubs-account-1.csv");
    const second = await preview("ubs-account-1.csv");
    const hashes = first.rows.map((row) => row.dedupeHash);
    expect(new Set(hashes).size).toBe(hashes.length);
    expect(second.rows.map((row) => row.dedupeHash)).toEqual(hashes);
  });
});
