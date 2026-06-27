import { ApiError } from "@/lib/api/errors";
import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { assertTrustedOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db/prisma";
import { goalUpdateSchema } from "@/lib/optimize/schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAuthenticatedContext("optimize.run");
    const input = await readJson(request, goalUpdateSchema);
    const { id } = await params;

    const goal = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.financialGoal.updateMany({
        where: { id, householdId: context.householdId, deletedAt: null },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.targetAmount !== undefined ? { targetAmount: input.targetAmount } : {}),
          ...(input.currentAmount !== undefined ? { currentAmount: input.currentAmount } : {}),
          ...(input.targetDate !== undefined ? { targetDate: input.targetDate } : {}),
          ...(input.plannedMonthlyContribution !== undefined
            ? { plannedMonthlyContribution: input.plannedMonthlyContribution }
            : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        },
      });
      if (updated.count === 0) throw new ApiError(404, "not_found", "Goal not found.");
      await writeAuditEvent(transaction, {
        householdId: context.householdId,
        userId: context.userId,
        action: "optimize.goal.update",
        resourceType: "FinancialGoal",
        resourceId: id,
        metadata: { fields: Object.keys(input) },
        ipAddress: requestIp(request),
      });
      return transaction.financialGoal.findFirstOrThrow({
        where: { id, householdId: context.householdId },
      });
    });
    return json(goal);
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const context = await requireAuthenticatedContext("optimize.run");
    const { id } = await params;

    await prisma.$transaction(async (transaction) => {
      const deleted = await transaction.financialGoal.updateMany({
        where: { id, householdId: context.householdId, deletedAt: null },
        data: { active: false, deletedAt: new Date() },
      });
      if (deleted.count === 0) throw new ApiError(404, "not_found", "Goal not found.");
      await writeAuditEvent(transaction, {
        householdId: context.householdId,
        userId: context.userId,
        action: "optimize.goal.delete",
        resourceType: "FinancialGoal",
        resourceId: id,
        ipAddress: requestIp(request),
      });
    });
    return json({ id, deleted: true });
  } catch (error) {
    return routeError(error);
  }
}
