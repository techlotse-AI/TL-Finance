import { ApiError } from "@/lib/api/errors";
import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { assertTrustedOrigin } from "@/lib/auth/origin";
import { prisma } from "@/lib/db/prisma";
import { holdingUpdateSchema } from "@/lib/optimize/schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAuthenticatedContext("optimize.run");
    const input = await readJson(request, holdingUpdateSchema);
    const { id } = await params;

    const holding = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.holding.updateMany({
        where: { id, householdId: context.householdId, deletedAt: null },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.symbol !== undefined ? { symbol: input.symbol } : {}),
          ...(input.unitPrice !== undefined ? { unitPrice: input.unitPrice, priceAsOf: new Date() } : {}),
        },
      });
      if (updated.count === 0) throw new ApiError(404, "not_found", "Holding not found.");
      await writeAuditEvent(transaction, {
        householdId: context.householdId,
        userId: context.userId,
        action: "optimize.holding.update",
        resourceType: "Holding",
        resourceId: id,
        metadata: { fields: Object.keys(input) },
        ipAddress: requestIp(request),
      });
      return transaction.holding.findFirstOrThrow({
        where: { id, householdId: context.householdId },
        include: { lots: { orderBy: { acquiredAt: "asc" } } },
      });
    });
    return json(holding);
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
      const deleted = await transaction.holding.updateMany({
        where: { id, householdId: context.householdId, deletedAt: null },
        data: { active: false, deletedAt: new Date() },
      });
      if (deleted.count === 0) throw new ApiError(404, "not_found", "Holding not found.");
      await writeAuditEvent(transaction, {
        householdId: context.householdId,
        userId: context.userId,
        action: "optimize.holding.delete",
        resourceType: "Holding",
        resourceId: id,
        ipAddress: requestIp(request),
      });
    });
    return json({ id, deleted: true });
  } catch (error) {
    return routeError(error);
  }
}
