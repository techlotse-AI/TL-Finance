import { ApiError } from "@/lib/api/errors";
import { json, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { assertTrustedOrigin } from "@/lib/auth/origin";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { prisma } from "@/lib/db/prisma";
import { compareProjectionScenarios } from "@/lib/optimize/projection";
import { scenarioPersistSchema } from "@/lib/optimize/schemas";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAuthenticatedContext("optimize.read");
    const { id } = await params;
    const saved = await prisma.scenarioComparison.findFirst({
      where: { id, householdId: context.householdId, deletedAt: null },
    });
    if (!saved) throw new ApiError(404, "not_found", "Scenario not found.");

    // Re-validate the stored definition before computing so a schema change can
    // never silently produce a malformed projection.
    const definition = scenarioPersistSchema.parse({
      name: saved.name,
      currency: saved.currency,
      startingAmount: saved.startingAmount.toString(),
      monthlyContribution: saved.monthlyContribution.toString(),
      years: saved.years,
      scenarios: saved.scenarios,
    });
    const result = compareProjectionScenarios({
      currency: definition.currency,
      startingAmount: definition.startingAmount,
      monthlyContribution: definition.monthlyContribution,
      years: definition.years,
      scenarios: definition.scenarios,
    });
    return json({ id: saved.id, name: saved.name, ...result });
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
      const deleted = await transaction.scenarioComparison.updateMany({
        where: { id, householdId: context.householdId, deletedAt: null },
        data: { active: false, deletedAt: new Date() },
      });
      if (deleted.count === 0) throw new ApiError(404, "not_found", "Scenario not found.");
      await writeAuditEvent(transaction, {
        householdId: context.householdId,
        userId: context.userId,
        action: "optimize.scenario.delete",
        resourceType: "ScenarioComparison",
        resourceId: id,
        ipAddress: requestIp(request),
      });
    });
    return json({ id, deleted: true });
  } catch (error) {
    return routeError(error);
  }
}
