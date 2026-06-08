import { ApiError } from "@/lib/api/errors";
import { json, readJson, routeError } from "@/lib/api/route";
import { toDbMatchField, toDbMatchType } from "@/lib/analysis/db-mapping";
import { patternForStorage } from "@/lib/analysis/rules";
import { createRuleSchema } from "@/lib/analysis/schemas";
import { requireOwnedBudgetItem } from "@/lib/analysis/ownership";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { requireOwnedCategory } from "@/lib/budget/ownership";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const context = await requireAuthenticatedContext("analysis.read");
    const rules = await prisma.transactionAllocationRule.findMany({
      where: { householdId: context.householdId, active: true },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      include: { category: { select: { name: true } }, budgetItem: { select: { name: true } } },
    });
    return json(rules);
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireAuthenticatedContext("analysis.write");
    const input = await readJson(request, createRuleSchema);
    const matchType = toDbMatchType(input.matchType);

    const rule = await prisma.$transaction(async (transaction) => {
      const category = await requireOwnedCategory(transaction, context.householdId, input.categoryId);
      if (input.budgetItemId) {
        const item = await requireOwnedBudgetItem(transaction, context.householdId, input.budgetItemId);
        if (item.categoryId !== category.id) {
          throw new ApiError(400, "budget_item_category_mismatch", "Budget item must belong to the rule category.");
        }
      }
      const created = await transaction.transactionAllocationRule.create({
        data: {
          householdId: context.householdId,
          matchField: toDbMatchField(input.matchField),
          matchType,
          normalizedPattern: patternForStorage(matchType, input.pattern),
          institution: input.institution ?? null,
          categoryId: input.categoryId,
          budgetItemId: input.budgetItemId ?? null,
          priority: input.priority,
        },
      });
      await writeAuditEvent(transaction, {
        householdId: context.householdId,
        userId: context.userId,
        action: "allocation_rule.create",
        resourceType: "TransactionAllocationRule",
        resourceId: created.id,
        ipAddress: requestIp(request),
      });
      return created;
    });

    return json(rule, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
