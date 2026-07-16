import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import { findTransferCandidates } from "@/lib/analysis/transfer-match-engine";
import type { TransferCandidateRow } from "@/lib/analysis/transfer-match";
import { UnsupportedStatementError } from "@/lib/statements/errors";
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
    expect(result.accountMatchReference).toBeUndefined();
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

  it("treats a credit/payment-received row as positive with no warnings", async () => {
    const result = await preview("ubs-card-2.csv");
    expect(result.parserKey).toBe("ubs-card");
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0].amount).toBe("-19.9000");
    expect(result.rows[1].amount).toBe("-88.1000");
    expect(result.rows[2].amount).toBe("200.0000");
    expect(result.rows[2].description).toBe("Payment received");
    expect(result.warnings).toHaveLength(0);
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

  it("imports a EUR wallet with an exchange credit, a transfer, and a refund with no warnings", async () => {
    const result = await preview("revolut-2.csv");
    expect(result.parserKey).toBe("revolut");
    expect(result.rows).toHaveLength(4);
    expect(result.rows.every((row) => row.currency === "EUR")).toBe(true);
    expect(result.rows[0].amount).toBe("490.8500"); // EXCHANGE credit
    expect(result.rows[1].amount).toBe("-22.4000"); // CARD_PAYMENT
    expect(result.rows[2].amount).toBe("-150.0000"); // TRANSFER
    expect(result.rows[2].counterparty).toBe("TRANSFER");
    expect(result.rows[3].amount).toBe("12.4000"); // CARD_REFUND, positive
    expect(result.warnings).toHaveLength(0);
  });
});

describe("cross-parser FX matching", () => {
  it("pairs a real Revolut CHF exchange debit with the matching EUR exchange credit from a different statement", async () => {
    const chf = await preview("revolut-1.csv");
    const eur = await preview("revolut-2.csv");
    const chfExchange = chf.rows.find((row) => row.counterparty === "EXCHANGE")!;
    const eurExchange = eur.rows.find((row) => row.counterparty === "EXCHANGE")!;
    expect(chfExchange.amount).toBe("-100.0000");
    expect(eurExchange.amount).toBe("490.8500");

    const rows: TransferCandidateRow[] = [
      {
        id: "chf-exchange",
        householdId: "household-1",
        accountPocketId: "pocket-chf",
        bookingDate: chfExchange.bookingDate,
        amount: chfExchange.amount,
        currency: "CHF",
        counterparty: chfExchange.counterparty,
      },
      {
        id: "eur-exchange",
        householdId: "household-1",
        accountPocketId: "pocket-eur",
        bookingDate: eurExchange.bookingDate,
        amount: eurExchange.amount,
        currency: "EUR",
        counterparty: eurExchange.counterparty,
      },
    ];

    const matches = findTransferCandidates(rows);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ debitId: "chf-exchange", creditId: "eur-exchange", fx: true });
    expect(matches[0].evidence).toContain("matching counterparty");
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
    expect(result.accountMatchReference).toBe("••••••••2957");
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

  it("throws an UnsupportedStatementError carrying every parser's detection reason for unrecognized content", async () => {
    const content = new TextEncoder().encode("this is not a statement at all\njust prose\n");
    await expect(previewStatement({ filename: "x.txt", content })).rejects.toBeInstanceOf(UnsupportedStatementError);
    try {
      await previewStatement({ filename: "x.txt", content });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(UnsupportedStatementError);
      const attempts = (error as UnsupportedStatementError).attempts;
      expect(attempts.length).toBeGreaterThanOrEqual(4); // ubs-account, ubs-card, revolut, generic-csv at minimum
      expect(attempts.every((attempt) => attempt.detection.confidence === 0)).toBe(true);
      expect(attempts.every((attempt) => attempt.detection.reasons.length > 0)).toBe(true);
    }
  });

  it("produces a stable, unique dedupe hash per row", async () => {
    const first = await preview("ubs-account-1.csv");
    const second = await preview("ubs-account-1.csv");
    const hashes = first.rows.map((row) => row.dedupeHash);
    expect(new Set(hashes).size).toBe(hashes.length);
    expect(second.rows.map((row) => row.dedupeHash)).toEqual(hashes);
  });

  it("dedupe hashing holds for the FNB CSV export, including its repeated same-description fee rows (v0.9.5 idempotent-commit requirement)", async () => {
    // The FNB fixture has three "#MONTHLY ACCOUNT FEE" rows with different
    // dates/amounts and two identical-description "SAMPLE SENDER" credits on
    // different dates — each must hash uniquely so idempotent commit never
    // drops a legitimate repeat, while re-previewing the same file must
    // reproduce identical hashes so re-importing it imports nothing new.
    const first = await preview("fnb-transaction-history-1.csv");
    expect(first.parserKey).toBe("fnb-transaction-history");
    expect(first.institution).toBe("FNB");
    const hashes = first.rows.map((row) => row.dedupeHash);
    expect(new Set(hashes).size).toBe(hashes.length);

    const second = await preview("fnb-transaction-history-1.csv");
    expect(second.rows.map((row) => row.dedupeHash)).toEqual(hashes);
  });
});
