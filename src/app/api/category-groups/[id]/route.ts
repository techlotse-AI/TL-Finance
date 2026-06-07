import { ApiError } from "@/lib/api/errors";
import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { assertRole } from "@/lib/auth/authorize";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { categoryGroupSchema } from "@/lib/budget/schemas";
import { prisma } from "@/lib/db/prisma";

const updateSchema = categoryGroupSchema.partial();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAuthenticatedContext("budget.write");
    assertRole(context.role, "admin");
    const { id } = await params;
    const input = await readJson(request, updateSchema);
    const result = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.categoryGroup.updateMany({
        where: { id, householdId: context.householdId, deletedAt: null },
        data: input,
      });
      if (updated.count !== 1) throw new ApiError(404, "not_found", "Category group was not found.");
      await writeAuditEvent(transaction, {
        householdId: context.householdId, userId: context.userId, action: "category_group.update",
        resourceType: "CategoryGroup", resourceId: id, ipAddress: requestIp(request),
      });
      return transaction.categoryGroup.findFirstOrThrow({ where: { id, householdId: context.householdId } });
    });
    return json(result);
  } catch (error) { return routeError(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAuthenticatedContext("budget.write");
    assertRole(context.role, "admin");
    const { id } = await params;
    const deleted = await prisma.$transaction(async (transaction) => {
      const references = await transaction.category.count({ where: { groupId: id, householdId: context.householdId, deletedAt: null } });
      if (references > 0) throw new ApiError(409, "referenced_record", "Delete or move categories first.");
      const result = await transaction.categoryGroup.updateMany({
        where: { id, householdId: context.householdId, deletedAt: null },
        data: { active: false, deletedAt: new Date() },
      });
      if (result.count !== 1) throw new ApiError(404, "not_found", "Category group was not found.");
      await writeAuditEvent(transaction, {
        householdId: context.householdId, userId: context.userId, action: "category_group.delete",
        resourceType: "CategoryGroup", resourceId: id, ipAddress: requestIp(request),
      });
      return result;
    });
    return json(deleted);
  } catch (error) { return routeError(error); }
}
