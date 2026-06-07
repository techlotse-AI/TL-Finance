import { ApiError } from "@/lib/api/errors";
import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { requireOwnedAccount } from "@/lib/budget/ownership";
import { accountPocketSchema } from "@/lib/budget/schemas";
import { prisma } from "@/lib/db/prisma";

const updateSchema = accountPocketSchema.partial();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAuthenticatedContext("budget.write");
    const { id } = await params;
    const input = await readJson(request, updateSchema);
    const pocket = await prisma.$transaction(async (transaction) => {
      if (input.accountId) await requireOwnedAccount(transaction, context.householdId, input.accountId);
      const updated = await transaction.accountPocket.updateMany({
        where: { id, householdId: context.householdId, deletedAt: null },
        data: input,
      });
      if (updated.count !== 1) throw new ApiError(404, "not_found", "Account pocket was not found.");
      await writeAuditEvent(transaction, {
        householdId: context.householdId, userId: context.userId, action: "account_pocket.update",
        resourceType: "AccountPocket", resourceId: id, ipAddress: requestIp(request),
      });
      return transaction.accountPocket.findFirstOrThrow({ where: { id, householdId: context.householdId } });
    });
    return json(pocket);
  } catch (error) { return routeError(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAuthenticatedContext("budget.write");
    const { id } = await params;
    const result = await prisma.$transaction(async (transaction) => {
      const references = await transaction.accountPocket.findFirst({
        where: {
          id, householdId: context.householdId, deletedAt: null,
          OR: [
            { incomeAllocations: { some: { deletedAt: null } } },
            { outgoingTransfers: { some: { deletedAt: null } } },
            { incomingTransfers: { some: { deletedAt: null } } },
            { fundedBudgetItems: { some: { deletedAt: null } } },
            { receivingBudgetItems: { some: { deletedAt: null } } },
          ],
        },
        select: { id: true },
      });
      if (references) throw new ApiError(409, "referenced_record", "Account pocket is used by active plan rows.");
      const updated = await transaction.accountPocket.updateMany({
        where: { id, householdId: context.householdId, deletedAt: null },
        data: { active: false, deletedAt: new Date() },
      });
      if (updated.count !== 1) throw new ApiError(404, "not_found", "Account pocket was not found.");
      await writeAuditEvent(transaction, {
        householdId: context.householdId, userId: context.userId, action: "account_pocket.delete",
        resourceType: "AccountPocket", resourceId: id, ipAddress: requestIp(request),
      });
      return updated;
    });
    return json(result);
  } catch (error) { return routeError(error); }
}
