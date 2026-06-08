import type { Prisma } from "@prisma/client";

import { ApiError } from "@/lib/api/errors";
import { json, readJson, routeError } from "@/lib/api/route";
import { statementCommitSchema } from "@/lib/analysis/schemas";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { requireOwnedPocket } from "@/lib/budget/ownership";
import { prisma } from "@/lib/db/prisma";
import { buildStatementRecords } from "@/lib/statements/commit";
import { previewStatement } from "@/lib/statements/preview";

export async function POST(request: Request) {
  try {
    const context = await requireAuthenticatedContext("analysis.write");
    const input = await readJson(request, statementCommitSchema);

    let preview;
    try {
      preview = await previewStatement({
        filename: input.filename,
        content: Uint8Array.from(Buffer.from(input.contentBase64, "base64")),
        contentType: input.contentType,
      });
    } catch {
      throw new ApiError(422, "unsupported_statement", "No production-ready parser recognized this statement.");
    }

    if (preview.rows.length === 0) {
      throw new ApiError(422, "no_rows", "The statement parsed without any importable rows.");
    }

    const result = await prisma.$transaction(async (transaction) => {
      const pocket = await requireOwnedPocket(transaction, context.householdId, input.accountPocketId);
      const warnings = JSON.parse(JSON.stringify(preview.warnings)) as Prisma.InputJsonValue;

      const record = await transaction.statementImport.upsert({
        where: {
          householdId_contentHash: { householdId: context.householdId, contentHash: preview.contentHash },
        },
        create: {
          householdId: context.householdId,
          accountPocketId: pocket.id,
          originalFilename: input.filename,
          contentHash: preview.contentHash,
          parserKey: preview.parserKey,
          parserVersion: preview.parserVersion,
          institution: preview.institution,
          status: "COMMITTED",
          rowCount: preview.rows.length,
          warningCount: preview.warnings.length,
          warnings,
        },
        update: {
          accountPocketId: pocket.id,
          parserKey: preview.parserKey,
          parserVersion: preview.parserVersion,
          institution: preview.institution,
          status: "COMMITTED",
          rowCount: preview.rows.length,
          warningCount: preview.warnings.length,
          warnings,
        },
      });

      const { records } = buildStatementRecords(preview, {
        householdId: context.householdId,
        statementImportId: record.id,
        accountPocketId: pocket.id,
      });

      const created = await transaction.actualTransaction.createMany({ data: records, skipDuplicates: true });
      const importedCount = created.count;
      const duplicateCount = preview.rows.length - importedCount;

      const updated = await transaction.statementImport.update({
        where: { id: record.id },
        data: { importedCount, duplicateCount, committedAt: new Date() },
      });

      await writeAuditEvent(transaction, {
        householdId: context.householdId,
        userId: context.userId,
        action: "statement_import.commit",
        resourceType: "StatementImport",
        resourceId: record.id,
        metadata: { importedCount, duplicateCount, parserKey: preview.parserKey },
        ipAddress: requestIp(request),
      });

      return { statementImport: updated, importedCount, duplicateCount };
    });

    return json({ ...result, warnings: preview.warnings }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
