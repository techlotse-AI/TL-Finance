import { ApiError } from "@/lib/api/errors";
import { json, readJson, routeError } from "@/lib/api/route";
import { reconcileActualAllocations } from "@/lib/analysis/allocation";
import { allocateTransactionSchema } from "@/lib/analysis/schemas";
import { requireOwnedBudgetItem, requireOwnedTransaction } from "@/lib/analysis/ownership";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { requireOwnedCategory } from "@/lib/budget/ownership";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAuthenticatedContext("analysis.write");
    const { id } = await params;
    const input = await readJson(request, allocateTransactionSchema);

    const result = await prisma.$transaction(async (transaction) => {
      const actual = await requireOwnedTransaction(transaction, context.householdId, id);

      for (const allocation of input.allocations) {
        const category = await requireOwnedCategory(transaction, context.householdId, allocation.categoryId);
        if (allocation.budgetItemId) {
          const item = await requireOwnedBudgetItem(transaction, context.householdId, allocation.budgetItemId);
          if (item.categoryId !== category.id) {
            throw new ApiError(400, "budget_item_category_mismatch", "Budget item must belong to the allocation category.");
          }
        }
      }

      const reconciliation = reconcileActualAllocations(actual.amount.toString(), input.allocations, true);

      await transaction.actualTransactionAllocation.deleteMany({ where: { transactionId: id, householdId: context.householdId } });
      await transaction.actualTransactionAllocation.createMany({
        data: input.allocations.map((allocation) => ({
          householdId: context.householdId,
          transactionId: id,
          categoryId: allocation.categoryId,
          budgetItemId: allocation.budgetItemId ?? null,
          amount: allocation.amount,
          source: "MANUAL" as const,
          confirmed: input.confirm,
        })),
      });

      const updated = await transaction.actualTransaction.update({
        where: { id },
        data: {
          reviewState: reconciliation.reconciled ? "ALLOCATED" : "PARTIAL",
          ignored: false,
        },
        include: {
          allocations: { include: { category: { select: { name: true } }, budgetItem: { select: { name: true } } } },
        },
      });

      await writeAuditEvent(transaction, {
        householdId: context.householdId,
        userId: context.userId,
        action: "transaction.allocate",
        resourceType: "ActualTransaction",
        resourceId: id,
        metadata: { reconciled: reconciliation.reconciled, parts: input.allocations.length },
        ipAddress: requestIp(request),
      });

      return { transaction: updated, reconciliation };
    });

    return json(result);
  } catch (error) {
    return routeError(error);
  }
}
