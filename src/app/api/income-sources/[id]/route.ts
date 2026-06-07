import { ApiError } from "@/lib/api/errors";
import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { toDbAllocationMethod, toDbRecurrence } from "@/lib/budget/db-mapping";
import { reconcileIncomeAllocations } from "@/lib/budget/income-allocations";
import { requireOwnedCategory, requireOwnedPocket } from "@/lib/budget/ownership";
import { incomeSourceWithAllocationsSchema } from "@/lib/budget/schemas";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAuthenticatedContext("budget.write");
    const { id } = await params;
    const input = await readJson(request, incomeSourceWithAllocationsSchema);
    reconcileIncomeAllocations(input.amount, input.allocations.map((allocation) =>
      allocation.method === "fixed"
        ? { method: "fixed" as const, fixedAmount: allocation.fixedAmount! }
        : { method: "percentage" as const, percentage: allocation.percentage! },
    ));
    const source = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.incomeSource.findFirst({ where: { id, householdId: context.householdId, deletedAt: null } });
      if (!existing) throw new ApiError(404, "not_found", "Income source was not found.");
      const category = await requireOwnedCategory(transaction, context.householdId, input.categoryId);
      if (category.kind !== "INCOME") throw new ApiError(400, "invalid_category_kind", "Income sources require an income category.");
      for (const allocation of input.allocations) await requireOwnedPocket(transaction, context.householdId, allocation.accountPocketId);
      const existingAllocations = await transaction.incomeAllocation.findMany({
        where: { incomeSourceId: id, householdId: context.householdId },
      });
      const retainedPocketIds = input.allocations.map((allocation) => allocation.accountPocketId);
      await transaction.incomeAllocation.updateMany({
        where: {
          incomeSourceId: id, householdId: context.householdId, deletedAt: null,
          accountPocketId: { notIn: retainedPocketIds },
        },
        data: { active: false, deletedAt: new Date() },
      });
      for (const allocation of input.allocations) {
        const existingAllocation = existingAllocations.find(
          (candidate) => candidate.accountPocketId === allocation.accountPocketId,
        );
        const data = {
          method: toDbAllocationMethod(allocation.method),
          fixedAmount: allocation.fixedAmount,
          percentage: allocation.percentage,
          sourceCurrency: allocation.sourceCurrency,
          active: true,
          deletedAt: null,
        };
        if (existingAllocation) {
          await transaction.incomeAllocation.update({ where: { id: existingAllocation.id }, data });
        } else {
          await transaction.incomeAllocation.create({
            data: {
              ...data, householdId: context.householdId, incomeSourceId: id,
              accountPocketId: allocation.accountPocketId,
            },
          });
        }
      }
      const updated = await transaction.incomeSource.update({
        where: { id },
        data: {
          name: input.name, categoryId: input.categoryId, amount: input.amount, currency: input.currency,
          recurrence: toDbRecurrence(input.recurrence), selectedMonths: input.selectedMonths,
          startDate: input.startDate, endDate: input.endDate,
        },
        include: { allocations: { where: { deletedAt: null } } },
      });
      await writeAuditEvent(transaction, {
        householdId: context.householdId, userId: context.userId, action: "income_source.update",
        resourceType: "IncomeSource", resourceId: id, ipAddress: requestIp(request),
      });
      return updated;
    });
    return json(source);
  } catch (error) { return routeError(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAuthenticatedContext("budget.write");
    const { id } = await params;
    const result = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.incomeSource.updateMany({
        where: { id, householdId: context.householdId, deletedAt: null },
        data: { active: false, deletedAt: new Date() },
      });
      if (updated.count !== 1) throw new ApiError(404, "not_found", "Income source was not found.");
      await transaction.incomeAllocation.updateMany({
        where: { incomeSourceId: id, householdId: context.householdId, deletedAt: null },
        data: { active: false, deletedAt: new Date() },
      });
      await writeAuditEvent(transaction, {
        householdId: context.householdId, userId: context.userId, action: "income_source.delete",
        resourceType: "IncomeSource", resourceId: id, ipAddress: requestIp(request),
      });
      return updated;
    });
    return json(result);
  } catch (error) { return routeError(error); }
}
