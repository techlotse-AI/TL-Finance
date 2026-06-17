import { ApiError } from "@/lib/api/errors";
import { json, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { assertTrustedOrigin } from "@/lib/auth/origin";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { prisma } from "@/lib/db/prisma";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const context = await requireAuthenticatedContext("optimize.run");
    const { id } = await params;
    await prisma.$transaction(async (transaction) => {
      const deleted = await transaction.pensionVehicle.updateMany({
        where: { id, householdId: context.householdId, deletedAt: null },
        data: { active: false, deletedAt: new Date() },
      });
      if (deleted.count === 0) throw new ApiError(404, "not_found", "Pension vehicle not found.");
      await writeAuditEvent(transaction, {
        householdId: context.householdId,
        userId: context.userId,
        action: "optimize.pension.delete",
        resourceType: "PensionVehicle",
        resourceId: id,
        ipAddress: requestIp(request),
      });
    });
    return json({ id, deleted: true });
  } catch (error) {
    return routeError(error);
  }
}
