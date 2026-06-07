import { ApiError } from "@/lib/api/errors";
import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { toDbAccountType } from "@/lib/budget/db-mapping";
import { accountSchema } from "@/lib/budget/schemas";
import { prisma } from "@/lib/db/prisma";

const updateSchema = accountSchema.partial();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAuthenticatedContext("budget.write");
    const { id } = await params;
    const input = await readJson(request, updateSchema);
    const account = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.account.updateMany({
        where: { id, householdId: context.householdId, deletedAt: null },
        data: { ...input, type: input.type ? toDbAccountType(input.type) : undefined },
      });
      if (updated.count !== 1) throw new ApiError(404, "not_found", "Account was not found.");
      await writeAuditEvent(transaction, {
        householdId: context.householdId, userId: context.userId, action: "account.update",
        resourceType: "Account", resourceId: id, ipAddress: requestIp(request),
      });
      return transaction.account.findFirstOrThrow({ where: { id, householdId: context.householdId } });
    });
    return json(account);
  } catch (error) { return routeError(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAuthenticatedContext("budget.write");
    const { id } = await params;
    const result = await prisma.$transaction(async (transaction) => {
      const activePocketReferences = await transaction.accountPocket.findFirst({
        where: {
          accountId: id, householdId: context.householdId, deletedAt: null,
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
      if (activePocketReferences) throw new ApiError(409, "referenced_record", "Account pockets are used by active plan rows.");
      await transaction.accountPocket.updateMany({
        where: { accountId: id, householdId: context.householdId, deletedAt: null },
        data: { active: false, deletedAt: new Date() },
      });
      const updated = await transaction.account.updateMany({
        where: { id, householdId: context.householdId, deletedAt: null },
        data: { active: false, deletedAt: new Date() },
      });
      if (updated.count !== 1) throw new ApiError(404, "not_found", "Account was not found.");
      await writeAuditEvent(transaction, {
        householdId: context.householdId, userId: context.userId, action: "account.delete",
        resourceType: "Account", resourceId: id, ipAddress: requestIp(request),
      });
      return updated;
    });
    return json(result);
  } catch (error) { return routeError(error); }
}
