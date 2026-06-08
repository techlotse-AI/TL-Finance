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

export async function GET() {
  try {
    const context = await requireAuthenticatedContext("budget.read");
    return json(await prisma.incomeSource.findMany({
      where: { householdId: context.householdId, deletedAt: null },
      include: {
        category: { select: { name: true } },
        allocations: {
          where: { deletedAt: null },
          include: { accountPocket: { include: { account: { select: { name: true } } } } },
        },
      },
      orderBy: { name: "asc" },
    }));
  } catch (error) { return routeError(error); }
}

export async function POST(request: Request) {
  try {
    const context = await requireAuthenticatedContext("budget.write");
    const input = await readJson(request, incomeSourceWithAllocationsSchema);
    reconcileIncomeAllocations(input.amount, input.allocations.map((allocation) =>
      allocation.method === "fixed"
        ? { method: "fixed" as const, fixedAmount: allocation.fixedAmount! }
        : { method: "percentage" as const, percentage: allocation.percentage! },
    ));
    const source = await prisma.$transaction(async (transaction) => {
      const category = await requireOwnedCategory(transaction, context.householdId, input.categoryId);
      if (category.kind !== "INCOME") throw new ApiError(400, "invalid_category_kind", "Income sources require an income category.");
      for (const allocation of input.allocations) {
        const pocket = await requireOwnedPocket(transaction, context.householdId, allocation.accountPocketId);
        if (allocation.sourceCurrency !== input.currency) throw new ApiError(400, "currency_mismatch", "Allocation source currency must match the income source.");
        if (pocket.currency !== input.currency) throw new ApiError(400, "currency_mismatch", "Receiving account must support the income currency.");
      }
      const created = await transaction.incomeSource.create({
        data: {
          householdId: context.householdId,
          name: input.name,
          categoryId: input.categoryId,
          amount: input.amount,
          currency: input.currency,
          recurrence: toDbRecurrence(input.recurrence),
          selectedMonths: input.selectedMonths,
          startDate: input.startDate,
          endDate: input.endDate,
          allocations: {
            create: input.allocations.map((allocation) => ({
              householdId: context.householdId,
              accountPocketId: allocation.accountPocketId,
              method: toDbAllocationMethod(allocation.method),
              fixedAmount: allocation.fixedAmount,
              percentage: allocation.percentage,
              sourceCurrency: allocation.sourceCurrency,
            })),
          },
        },
        include: { allocations: true },
      });
      await writeAuditEvent(transaction, {
        householdId: context.householdId, userId: context.userId, action: "income_source.create",
        resourceType: "IncomeSource", resourceId: created.id, ipAddress: requestIp(request),
      });
      return created;
    });
    return json(source, { status: 201 });
  } catch (error) { return routeError(error); }
}
