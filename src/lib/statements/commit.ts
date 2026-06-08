import type { Prisma } from "@prisma/client";

import { normalizeMerchantKey } from "@/lib/analysis/normalize";
import type { previewStatement } from "@/lib/statements/preview";

type StatementPreview = Awaited<ReturnType<typeof previewStatement>>;

export interface CommitTarget {
  householdId: string;
  statementImportId: string;
  accountPocketId: string;
}

export interface BuiltStatementRecords {
  records: Prisma.ActualTransactionCreateManyInput[];
  duplicateInFileCount: number;
}

/**
 * Maps a deterministic preview into ActualTransaction create inputs. Drops rows
 * that duplicate an earlier row in the same file (by dedupe hash) so a file with
 * repeated lines never double-books. Cross-file and re-commit deduplication is
 * enforced by the unique (householdId, dedupeHash) index at write time.
 */
export function buildStatementRecords(
  preview: StatementPreview,
  target: CommitTarget,
): BuiltStatementRecords {
  const seen = new Set<string>();
  const records: Prisma.ActualTransactionCreateManyInput[] = [];
  let duplicateInFileCount = 0;

  for (const row of preview.rows) {
    if (seen.has(row.dedupeHash)) {
      duplicateInFileCount += 1;
      continue;
    }
    seen.add(row.dedupeHash);

    records.push({
      householdId: target.householdId,
      statementImportId: target.statementImportId,
      accountPocketId: target.accountPocketId,
      bookingDate: new Date(`${row.bookingDate}T00:00:00.000Z`),
      valueDate: row.valueDate ? new Date(`${row.valueDate}T00:00:00.000Z`) : null,
      amount: row.amount,
      currency: row.currency,
      description: row.description,
      counterparty: row.counterparty ?? null,
      reference: row.reference ?? null,
      balanceAfter: row.balanceAfter ?? null,
      normalizedMerchantKey: normalizeMerchantKey(row.description, row.counterparty) || null,
      sourceInstitution: preview.institution,
      parserVersion: preview.parserVersion,
      originalRow: row.originalRow as Prisma.InputJsonValue,
      dedupeHash: row.dedupeHash,
      reviewState: "UNREVIEWED",
    });
  }

  return { records, duplicateInFileCount };
}
