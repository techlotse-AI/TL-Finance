import { ApiError } from "@/lib/api/errors";
import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedSession } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { prisma } from "@/lib/db/prisma";
import { adminUserUpdateSchema } from "@/lib/platform/schemas";

export async function POST(request: Request) {
  try {
    const session = await requireAuthenticatedSession();
    if (!session.instanceAdmin) throw new ApiError(403, "forbidden", "Instance administrator access is required.");
    const input = await readJson(request, adminUserUpdateSchema);
    if (input.userId === session.userId && (!input.active || !input.instanceAdmin)) {
      throw new ApiError(400, "self_lockout", "You cannot deactivate or remove administrator access from your current user.");
    }
    const user = await prisma.$transaction(async (transaction) => {
      const target = await transaction.user.findUnique({
        where: { id: input.userId },
        select: { active: true, instanceAdmin: true },
      });
      if (!target) throw new ApiError(404, "not_found", "User not found.");
      if (
        target.active &&
        target.instanceAdmin &&
        (!input.active || !input.instanceAdmin) &&
        await transaction.user.count({ where: { active: true, instanceAdmin: true } }) === 1
      ) {
        throw new ApiError(400, "last_administrator", "The final active platform administrator cannot be deactivated or demoted.");
      }
      const updated = await transaction.user.update({
        where: { id: input.userId },
        data: { active: input.active, instanceAdmin: input.instanceAdmin },
        select: { id: true, email: true, active: true, instanceAdmin: true },
      });
      if (!input.active) {
        await transaction.session.updateMany({
          where: { userId: input.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await writeAuditEvent(transaction, {
        userId: session.userId,
        action: "platform.user.update",
        resourceType: "User",
        resourceId: input.userId,
        metadata: { active: input.active, instanceAdmin: input.instanceAdmin },
        ipAddress: requestIp(request),
      });
      return updated;
    });
    return json(user);
  } catch (error) {
    return routeError(error);
  }
}
