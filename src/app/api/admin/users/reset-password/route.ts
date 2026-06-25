import { ApiError } from "@/lib/api/errors";
import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedSession } from "@/lib/auth/context";
import { hashPassword } from "@/lib/auth/password";
import { requestIp } from "@/lib/auth/request";
import { prisma } from "@/lib/db/prisma";
import { selectBulkResetUserIds } from "@/lib/platform/admin-users";
import { adminPasswordResetSchema } from "@/lib/platform/schemas";

/**
 * Administrator password reset. Sets a temporary password for a single user, or
 * for every active non-administrator user in bulk, then revokes the affected
 * users' sessions and clears any lockout. Instance admin only.
 */
export async function POST(request: Request) {
  try {
    const session = await requireAuthenticatedSession();
    if (!session.instanceAdmin) throw new ApiError(403, "forbidden", "Instance administrator access is required.");
    const input = await readJson(request, adminPasswordResetSchema);
    const passwordHash = await hashPassword(input.newPassword);

    const result = await prisma.$transaction(async (transaction) => {
      let userIds: string[];
      if (input.userId) {
        const target = await transaction.user.findUnique({ where: { id: input.userId }, select: { id: true } });
        if (!target) throw new ApiError(404, "not_found", "User not found.");
        userIds = [target.id];
      } else {
        const users = await transaction.user.findMany({ select: { id: true, active: true, instanceAdmin: true } });
        userIds = selectBulkResetUserIds(users, session.userId);
      }

      if (userIds.length > 0) {
        await transaction.user.updateMany({
          where: { id: { in: userIds } },
          data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
        });
        await transaction.session.updateMany({
          where: { userId: { in: userIds }, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await writeAuditEvent(transaction, {
        userId: session.userId,
        action: input.userId ? "platform.user.password_reset" : "platform.user.password_reset_bulk",
        resourceType: "User",
        resourceId: input.userId ?? undefined,
        metadata: { count: userIds.length },
        ipAddress: requestIp(request),
      });
      return { count: userIds.length };
    });
    return json({ reset: true, ...result });
  } catch (error) {
    return routeError(error);
  }
}
