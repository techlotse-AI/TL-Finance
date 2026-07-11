import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { prisma } from "@/lib/db/prisma";
import { wealthPlanPersistSchema } from "@/lib/optimize/schemas";

export async function GET() {
  try {
    const context = await requireAuthenticatedContext("optimize.read");
    const plans = await prisma.wealthPlan.findMany({
      where: { householdId: context.householdId, deletedAt: null },
      orderBy: { name: "asc" },
    });
    return json(plans);
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireAuthenticatedContext("optimize.run");
    const input = await readJson(request, wealthPlanPersistSchema);

    const plan = await prisma.$transaction(async (transaction) => {
      const created = await transaction.wealthPlan.create({
        data: {
          householdId: context.householdId,
          name: input.name,
          currency: input.currency,
          config: input.config,
        },
      });
      await writeAuditEvent(transaction, {
        householdId: context.householdId,
        userId: context.userId,
        action: "optimize.wealth_plan.create",
        resourceType: "WealthPlan",
        resourceId: created.id,
        metadata: { currency: input.currency, configVersion: input.config.version },
        ipAddress: requestIp(request),
      });
      return created;
    });
    return json(plan, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
