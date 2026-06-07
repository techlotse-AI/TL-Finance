import { ApiError } from "@/lib/api/errors";
import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { toDbCategoryKind, toDbRecurrence } from "@/lib/budget/db-mapping";
import { requireOwnedCategory, requireOwnedPocket } from "@/lib/budget/ownership";
import { budgetItemSchema } from "@/lib/budget/schemas";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAuthenticatedContext("budget.write");
    const { id } = await params;
    const input = await readJson(request, budgetItemSchema);
    const item = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.budgetItem.findFirst({ where: { id, householdId: context.householdId, deletedAt: null } });
      if (!existing) throw new ApiError(404, "not_found", "Budget item was not found.");
      const category = await requireOwnedCategory(transaction, context.householdId, input.categoryId);
      if (category.kind !== toDbCategoryKind(input.kind)) throw new ApiError(400, "invalid_category_kind", "Budget item kind must match its category.");
      if (input.paidFromAccountPocketId) await requireOwnedPocket(transaction, context.householdId, input.paidFromAccountPocketId);
      if (input.paidToAccountPocketId) await requireOwnedPocket(transaction, context.householdId, input.paidToAccountPocketId);
      const updated = await transaction.budgetItem.update({
        where: { id },
        data: { ...input, kind: toDbCategoryKind(input.kind), recurrence: toDbRecurrence(input.recurrence) },
      });
      await writeAuditEvent(transaction, {
        householdId: context.householdId, userId: context.userId, action: "budget_item.update",
        resourceType: "BudgetItem", resourceId: id, ipAddress: requestIp(request),
      });
      return updated;
    });
    return json(item);
  } catch (error) { return routeError(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAuthenticatedContext("budget.write");
    const { id } = await params;
    const result = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.budgetItem.updateMany({
        where: { id, householdId: context.householdId, deletedAt: null },
        data: { active: false, deletedAt: new Date() },
      });
      if (updated.count !== 1) throw new ApiError(404, "not_found", "Budget item was not found.");
      await writeAuditEvent(transaction, {
        householdId: context.householdId, userId: context.userId, action: "budget_item.delete",
        resourceType: "BudgetItem", resourceId: id, ipAddress: requestIp(request),
      });
      return updated;
    });
    return json(result);
  } catch (error) { return routeError(error); }
}
