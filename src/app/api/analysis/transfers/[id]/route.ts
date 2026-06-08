import { ApiError } from "@/lib/api/errors";
import { json, readJson, routeError } from "@/lib/api/route";
import { toDbTransferStatus } from "@/lib/analysis/db-mapping";
import { transferDecisionSchema } from "@/lib/analysis/schemas";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAuthenticatedContext("analysis.write");
    const { id } = await params;
    const input = await readJson(request, transferDecisionSchema);
    const confirmed = input.decision === "confirmed";

    const updated = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.transactionTransferMatch.findFirst({
        where: { id, householdId: context.householdId },
        select: { id: true },
      });
      if (!existing) throw new ApiError(404, "transfer_match_not_found", "Transfer match not found.");

      const result = await transaction.transactionTransferMatch.update({
        where: { id },
        data: {
          status: toDbTransferStatus(input.decision),
          confirmedByUserId: confirmed ? context.userId : null,
          confirmedAt: confirmed ? new Date() : null,
        },
      });
      await writeAuditEvent(transaction, {
        householdId: context.householdId,
        userId: context.userId,
        action: confirmed ? "transfer_match.confirm" : "transfer_match.reject",
        resourceType: "TransactionTransferMatch",
        resourceId: id,
        ipAddress: requestIp(request),
      });
      return result;
    });

    return json(updated);
  } catch (error) {
    return routeError(error);
  }
}
