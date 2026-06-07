import { ApiError } from "@/lib/api/errors";
import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { assertRole } from "@/lib/auth/authorize";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { toDbCategoryKind } from "@/lib/budget/db-mapping";
import { requireOwnedCategoryGroup } from "@/lib/budget/ownership";
import { categorySchema } from "@/lib/budget/schemas";
import { prisma } from "@/lib/db/prisma";

const updateSchema = categorySchema.partial();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAuthenticatedContext("budget.write");
    assertRole(context.role, "admin");
    const { id } = await params;
    const input = await readJson(request, updateSchema);
    const category = await prisma.$transaction(async (transaction) => {
      if (input.groupId) await requireOwnedCategoryGroup(transaction, context.householdId, input.groupId);
      const result = await transaction.category.updateMany({
        where: { id, householdId: context.householdId, deletedAt: null },
        data: { ...input, kind: input.kind ? toDbCategoryKind(input.kind) : undefined },
      });
      if (result.count !== 1) throw new ApiError(404, "not_found", "Category was not found.");
      await writeAuditEvent(transaction, {
        householdId: context.householdId, userId: context.userId, action: "category.update",
        resourceType: "Category", resourceId: id, ipAddress: requestIp(request),
      });
      return transaction.category.findFirstOrThrow({ where: { id, householdId: context.householdId } });
    });
    return json(category);
  } catch (error) { return routeError(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAuthenticatedContext("budget.write");
    assertRole(context.role, "admin");
    const { id } = await params;
    const result = await prisma.$transaction(async (transaction) => {
      const references = await transaction.category.findFirst({
        where: { id, householdId: context.householdId, OR: [{ incomeSources: { some: { deletedAt: null } } }, { budgetItems: { some: { deletedAt: null } } }] },
        select: { id: true },
      });
      if (references) throw new ApiError(409, "referenced_record", "Category is used by active plan rows.");
      const updated = await transaction.category.updateMany({
        where: { id, householdId: context.householdId, deletedAt: null },
        data: { active: false, deletedAt: new Date() },
      });
      if (updated.count !== 1) throw new ApiError(404, "not_found", "Category was not found.");
      await writeAuditEvent(transaction, {
        householdId: context.householdId, userId: context.userId, action: "category.delete",
        resourceType: "Category", resourceId: id, ipAddress: requestIp(request),
      });
      return updated;
    });
    return json(result);
  } catch (error) { return routeError(error); }
}
