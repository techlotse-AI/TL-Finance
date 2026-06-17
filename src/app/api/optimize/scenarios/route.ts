import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { prisma } from "@/lib/db/prisma";
import { scenarioPersistSchema } from "@/lib/optimize/schemas";

export async function GET() {
  try {
    const context = await requireAuthenticatedContext("optimize.read");
    const scenarios = await prisma.scenarioComparison.findMany({
      where: { householdId: context.householdId, deletedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        currency: true,
        startingAmount: true,
        monthlyContribution: true,
        years: true,
        scenarios: true,
        updatedAt: true,
      },
    });
    return json(scenarios);
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireAuthenticatedContext("optimize.run");
    const input = await readJson(request, scenarioPersistSchema);
    const created = await prisma.$transaction(async (transaction) => {
      const saved = await transaction.scenarioComparison.create({
        data: {
          householdId: context.householdId,
          name: input.name,
          currency: input.currency,
          startingAmount: input.startingAmount,
          monthlyContribution: input.monthlyContribution,
          years: input.years,
          scenarios: input.scenarios,
        },
      });
      await writeAuditEvent(transaction, {
        householdId: context.householdId,
        userId: context.userId,
        action: "optimize.scenario.create",
        resourceType: "ScenarioComparison",
        resourceId: saved.id,
        ipAddress: requestIp(request),
      });
      return saved;
    });
    return json(created, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
