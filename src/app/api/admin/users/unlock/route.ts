import { ApiError } from "@/lib/api/errors";
import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedSession } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { prisma } from "@/lib/db/prisma";
import { adminUserUnlockSchema } from "@/lib/platform/schemas";

export async function POST(request: Request) {
  try {
    const session = await requireAuthenticatedSession();
    if (!session.instanceAdmin) {
      throw new ApiError(403, "forbidden", "Instance administrator access is required.");
    }
    const input = await readJson(request, adminUserUnlockSchema);

    const user = await prisma.$transaction(async (transaction) => {
      const cleared = await transaction.user.updateMany({
        where: { id: input.userId },
        data: { failedLoginCount: 0, lockedUntil: null },
      });
      if (cleared.count === 0) throw new ApiError(404, "not_found", "User not found.");
      await writeAuditEvent(transaction, {
        userId: session.userId,
        action: "auth.account.unlocked",
        resourceType: "User",
        resourceId: input.userId,
        ipAddress: requestIp(request),
      });
      return transaction.user.findUniqueOrThrow({
        where: { id: input.userId },
        select: { id: true, email: true, failedLoginCount: true, lockedUntil: true },
      });
    });
    return json(user);
  } catch (error) {
    return routeError(error);
  }
}
