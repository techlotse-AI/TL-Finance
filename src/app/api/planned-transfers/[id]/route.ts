import { ApiError } from "@/lib/api/errors";
import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { toDbRecurrence } from "@/lib/budget/db-mapping";
import { requireOwnedPocket } from "@/lib/budget/ownership";
import { plannedTransferSchema } from "@/lib/budget/schemas";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAuthenticatedContext("budget.write");
    const { id } = await params;
    const input = await readJson(request, plannedTransferSchema);
    const transfer = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.plannedAccountTransfer.findFirst({
        where: { id, householdId: context.householdId, deletedAt: null },
      });
      if (!existing) throw new ApiError(404, "not_found", "Planned transfer was not found.");
      const fromId = input.fromAccountPocketId;
      const toId = input.toAccountPocketId;
      if (fromId === toId) throw new ApiError(400, "invalid_transfer", "Source and destination pockets must differ.");
      await requireOwnedPocket(transaction, context.householdId, input.fromAccountPocketId);
      await requireOwnedPocket(transaction, context.householdId, input.toAccountPocketId);
      const updated = await transaction.plannedAccountTransfer.update({
        where: { id },
        data: { ...input, recurrence: toDbRecurrence(input.recurrence) },
      });
      await writeAuditEvent(transaction, {
        householdId: context.householdId, userId: context.userId, action: "planned_transfer.update",
        resourceType: "PlannedAccountTransfer", resourceId: id, ipAddress: requestIp(request),
      });
      return updated;
    });
    return json(transfer);
  } catch (error) { return routeError(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAuthenticatedContext("budget.write");
    const { id } = await params;
    const result = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.plannedAccountTransfer.updateMany({
        where: { id, householdId: context.householdId, deletedAt: null },
        data: { active: false, deletedAt: new Date() },
      });
      if (updated.count !== 1) throw new ApiError(404, "not_found", "Planned transfer was not found.");
      await writeAuditEvent(transaction, {
        householdId: context.householdId, userId: context.userId, action: "planned_transfer.delete",
        resourceType: "PlannedAccountTransfer", resourceId: id, ipAddress: requestIp(request),
      });
      return updated;
    });
    return json(result);
  } catch (error) { return routeError(error); }
}
