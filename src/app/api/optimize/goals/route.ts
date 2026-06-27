import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { prisma } from "@/lib/db/prisma";
import { computeGoals, monthsUntil, type GoalInput } from "@/lib/optimize/goals";
import { reportingRateMap } from "@/lib/optimize/queries";
import { goalCreateSchema } from "@/lib/optimize/schemas";

export async function GET() {
  try {
    const context = await requireAuthenticatedContext("optimize.read");
    const [household, goals] = await Promise.all([
      prisma.household.findUniqueOrThrow({
        where: { id: context.householdId },
        select: { baseCurrency: true },
      }),
      prisma.financialGoal.findMany({
        where: { householdId: context.householdId, deletedAt: null },
        orderBy: { name: "asc" },
      }),
    ]);

    const reportingCurrency = household.baseCurrency;
    const rates = await reportingRateMap(context.householdId, reportingCurrency);
    const now = new Date();

    const goalInputs: GoalInput[] = goals.map((goal) => ({
      id: goal.id,
      name: goal.name,
      currency: goal.currency,
      targetAmount: goal.targetAmount.toString(),
      currentAmount: goal.currentAmount.toString(),
      monthsRemaining: goal.targetDate ? monthsUntil(now, goal.targetDate) : null,
      plannedMonthlyContribution:
        goal.plannedMonthlyContribution !== null ? goal.plannedMonthlyContribution.toString() : undefined,
    }));

    const result = computeGoals({ reportingCurrency, rates, goals: goalInputs });
    // Echo persistence-only fields the engine does not carry.
    const withMeta = result.goals.map((computed, index) => ({
      ...computed,
      targetDate: goals[index].targetDate ? goals[index].targetDate!.toISOString().slice(0, 10) : null,
      notes: goals[index].notes,
    }));
    return json({ ...result, goals: withMeta });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireAuthenticatedContext("optimize.run");
    const input = await readJson(request, goalCreateSchema);

    const goal = await prisma.$transaction(async (transaction) => {
      const created = await transaction.financialGoal.create({
        data: {
          householdId: context.householdId,
          name: input.name,
          currency: input.currency,
          targetAmount: input.targetAmount,
          currentAmount: input.currentAmount ?? "0",
          targetDate: input.targetDate ?? null,
          plannedMonthlyContribution: input.plannedMonthlyContribution ?? null,
          notes: input.notes ?? null,
        },
      });
      await writeAuditEvent(transaction, {
        householdId: context.householdId,
        userId: context.userId,
        action: "optimize.goal.create",
        resourceType: "FinancialGoal",
        resourceId: created.id,
        metadata: { currency: input.currency, hasTargetDate: input.targetDate != null },
        ipAddress: requestIp(request),
      });
      return created;
    });
    return json(goal, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
