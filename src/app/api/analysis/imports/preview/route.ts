import { ApiError } from "@/lib/api/errors";
import type { Prisma } from "@prisma/client";
import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { statementPreviewSchema } from "@/lib/analysis/schemas";
import { buildAccountSuggestion } from "@/lib/analysis/account-suggestion";
import { prisma } from "@/lib/db/prisma";
import { UnsupportedStatementError, unsupportedStatementMessage } from "@/lib/statements/errors";
import { previewStatement } from "@/lib/statements/preview";

export async function POST(request: Request) {
  try {
    const context = await requireAuthenticatedContext("analysis.write");
    const input = await readJson(request, statementPreviewSchema);
    let preview;
    try {
      preview = await previewStatement({
        filename: input.filename,
        content: Uint8Array.from(Buffer.from(input.contentBase64, "base64")),
        contentType: input.contentType,
      });
    } catch (error) {
      if (error instanceof UnsupportedStatementError) {
        throw new ApiError(422, "unsupported_statement", unsupportedStatementMessage(error));
      }
      throw new ApiError(422, "unsupported_statement", "No production-ready parser recognized this statement.");
    }
    const matchingAccounts = preview.accountMatchReference
      ? await prisma.account.findMany({
          where: {
            householdId: context.householdId,
            active: true,
            deletedAt: null,
            maskedReference: preview.accountMatchReference,
          },
          select: {
            id: true,
            name: true,
            maskedReference: true,
            pockets: {
              where: { active: true, deletedAt: null },
              select: { id: true, currency: true },
            },
          },
          take: 2,
        })
      : [];
    const accountSuggestion = buildAccountSuggestion(
      matchingAccounts,
      preview.rows.map((row) => row.currency),
    );
    const statementImport = await prisma.$transaction(async (transaction) => {
      const warnings = JSON.parse(JSON.stringify(preview.warnings)) as Prisma.InputJsonValue;
      const record = await transaction.statementImport.upsert({
        where: { householdId_contentHash: { householdId: context.householdId, contentHash: preview.contentHash } },
        create: {
          householdId: context.householdId, originalFilename: input.filename, contentHash: preview.contentHash,
          parserKey: preview.parserKey, parserVersion: preview.parserVersion, institution: preview.institution,
          status: "PREVIEWED", rowCount: preview.rows.length, warningCount: preview.warnings.length, warnings,
        },
        update: {
          originalFilename: input.filename, parserKey: preview.parserKey, parserVersion: preview.parserVersion,
          institution: preview.institution, status: "PREVIEWED", rowCount: preview.rows.length,
          warningCount: preview.warnings.length, warnings,
        },
      });
      await writeAuditEvent(transaction, {
        householdId: context.householdId, userId: context.userId, action: "statement_import.preview",
        resourceType: "StatementImport", resourceId: record.id, metadata: { rowCount: preview.rows.length },
        ipAddress: requestIp(request),
      });
      return record;
    });
    return json({ statementImport, preview, accountSuggestion });
  } catch (error) { return routeError(error); }
}
