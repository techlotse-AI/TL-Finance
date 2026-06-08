import { json, readJson, routeError } from "@/lib/api/route";
import { ignoreTransactionSchema } from "@/lib/analysis/schemas";
import { requireOwnedTransaction } from "@/lib/analysis/ownership";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAuthenticatedContext("analysis.write");
    const { id } = await params;
    const input = await readJson(request, ignoreTransactionSchema);

    const updated = await prisma.$transaction(async (transaction) => {
      await requireOwnedTransaction(transaction, context.householdId, id);
      const allocationCount = await transaction.actualTransactionAllocation.count({
        where: { transactionId: id, householdId: context.householdId },
      });
      const result = await transaction.actualTransaction.update({
        where: { id },
        data: {
          ignored: input.ignored,
          reviewState: input.ignored ? "IGNORED" : allocationCount > 0 ? "ALLOCATED" : "UNREVIEWED",
        },
      });
      await writeAuditEvent(transaction, {
        householdId: context.householdId,
        userId: context.userId,
        action: input.ignored ? "transaction.ignore" : "transaction.unignore",
        resourceType: "ActualTransaction",
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
