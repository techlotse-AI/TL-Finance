import { ApiError } from "@/lib/api/errors";
import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { toDbCategoryKind, toDbRecurrence } from "@/lib/budget/db-mapping";
import { requireOwnedCategory, requireOwnedPocket } from "@/lib/budget/ownership";
import { budgetItemSchema } from "@/lib/budget/schemas";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const context = await requireAuthenticatedContext("budget.read");
    return json(await prisma.budgetItem.findMany({
      where: { householdId: context.householdId, deletedAt: null },
      include: {
        category: { select: { name: true } },
        paidFromAccountPocket: { include: { account: { select: { name: true } } } },
        paidToAccountPocket: { include: { account: { select: { name: true } } } },
      },
      orderBy: { name: "asc" },
    }));
  } catch (error) { return routeError(error); }
}

export async function POST(request: Request) {
  try {
    const context = await requireAuthenticatedContext("budget.write");
    const input = await readJson(request, budgetItemSchema);
    const item = await prisma.$transaction(async (transaction) => {
      const category = await requireOwnedCategory(transaction, context.householdId, input.categoryId);
      if (category.kind !== toDbCategoryKind(input.kind)) throw new ApiError(400, "invalid_category_kind", "Budget item kind must match its category.");
      if (input.paidFromAccountPocketId) await requireOwnedPocket(transaction, context.householdId, input.paidFromAccountPocketId);
      if (input.paidToAccountPocketId) await requireOwnedPocket(transaction, context.householdId, input.paidToAccountPocketId);
      const created = await transaction.budgetItem.create({
        data: {
          ...input, householdId: context.householdId, kind: toDbCategoryKind(input.kind),
          recurrence: toDbRecurrence(input.recurrence),
        },
      });
      await writeAuditEvent(transaction, {
        householdId: context.householdId, userId: context.userId, action: "budget_item.create",
        resourceType: "BudgetItem", resourceId: created.id, ipAddress: requestIp(request),
      });
      return created;
    });
    return json(item, { status: 201 });
  } catch (error) { return routeError(error); }
}
