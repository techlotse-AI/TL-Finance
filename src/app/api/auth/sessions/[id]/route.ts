import { ApiError } from "@/lib/api/errors";
import { json, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedSession } from "@/lib/auth/context";
import { assertTrustedOrigin } from "@/lib/auth/origin";
import { requestIp } from "@/lib/auth/request";
import { prisma } from "@/lib/db/prisma";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const session = await requireAuthenticatedSession();
    const { id } = await context.params;
    if (id === session.sessionId) {
      throw new ApiError(409, "current_session", "Use sign out to revoke the current session.");
    }
    await prisma.$transaction(async (transaction) => {
      const result = await transaction.session.updateMany({
        where: { id, userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (result.count !== 1) throw new ApiError(404, "session_not_found", "Session not found.");
      await writeAuditEvent(transaction, {
        userId: session.userId,
        action: "auth.session.revoke",
        resourceType: "Session",
        resourceId: id,
        ipAddress: requestIp(request),
      });
    });
    return json({ revoked: true });
  } catch (error) {
    return routeError(error);
  }
}
