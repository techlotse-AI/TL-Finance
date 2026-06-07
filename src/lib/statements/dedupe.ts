import { createHash } from "node:crypto";

import type { NormalizedStatementRow } from "@/lib/statements/types";

export function statementContentHash(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

export function transactionDedupeHash(
  institution: string,
  accountIdentity: string | undefined,
  row: NormalizedStatementRow,
): string {
  const canonical = [
    institution,
    accountIdentity ?? "",
    row.bookingDate,
    row.valueDate ?? "",
    row.amount,
    row.currency,
    normalizeText(row.description),
    normalizeText(row.counterparty ?? ""),
    normalizeText(row.reference ?? ""),
  ].join("\u001f");
  return createHash("sha256").update(canonical).digest("hex");
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
