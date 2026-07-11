import { ApiError } from "@/lib/api/errors";
import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { assertTrustedOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db/prisma";
import { wealthPlanPersistSchema } from "@/lib/optimize/schemas";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAuthenticatedContext("optimize.run");
    const input = await readJson(request, wealthPlanPersistSchema);
    const { id } = await params;

    const plan = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.wealthPlan.updateMany({
        where: { id, householdId: context.householdId, deletedAt: null },
        data: { name: input.name, currency: input.currency, config: input.config },
      });
      if (updated.count === 0) throw new ApiError(404, "not_found", "Wealth plan not found.");
      await writeAuditEvent(transaction, {
        householdId: context.householdId,
        userId: context.userId,
        action: "optimize.wealth_plan.update",
        resourceType: "WealthPlan",
        resourceId: id,
        metadata: { currency: input.currency, configVersion: input.config.version },
        ipAddress: requestIp(request),
      });
      return transaction.wealthPlan.findFirstOrThrow({
        where: { id, householdId: context.householdId },
      });
    });
    return json(plan);
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
      const deleted = await transaction.wealthPlan.updateMany({
        where: { id, householdId: context.householdId, deletedAt: null },
        data: { active: false, deletedAt: new Date() },
      });
      if (deleted.count === 0) throw new ApiError(404, "not_found", "Wealth plan not found.");
      await writeAuditEvent(transaction, {
        householdId: context.householdId,
        userId: context.userId,
        action: "optimize.wealth_plan.delete",
        resourceType: "WealthPlan",
        resourceId: id,
        ipAddress: requestIp(request),
      });
    });
    return json({ id, deleted: true });
  } catch (error) {
    return routeError(error);
  }
}
