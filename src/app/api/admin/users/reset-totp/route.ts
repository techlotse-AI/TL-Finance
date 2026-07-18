import { ApiError } from "@/lib/api/errors";
import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedSession } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { prisma } from "@/lib/db/prisma";
import { adminUserTotpResetSchema } from "@/lib/platform/schemas";

/**
 * Administrator recovery path for a user who lost both the authenticator and
 * the recovery codes — mirrors the account-unlock route. Clears the TOTP
 * credential, recovery codes, and outstanding challenges; the user signs in
 * with password only and can re-enroll.
 */
export async function POST(request: Request) {
  try {
    const session = await requireAuthenticatedSession();
    if (!session.instanceAdmin) {
      throw new ApiError(403, "forbidden", "Instance administrator access is required.");
    }
    const input = await readJson(request, adminUserTotpResetSchema);

    const user = await prisma.$transaction(async (transaction) => {
      const cleared = await transaction.user.updateMany({
        where: { id: input.userId },
        data: { totpSecretCiphertext: null, totpActivatedAt: null, totpLastUsedStep: null },
      });
      if (cleared.count === 0) throw new ApiError(404, "not_found", "User not found.");
      await transaction.totpRecoveryCode.deleteMany({ where: { userId: input.userId } });
      await transaction.totpChallenge.deleteMany({ where: { userId: input.userId } });
      await writeAuditEvent(transaction, {
        userId: session.userId,
        action: "auth.totp.admin_reset",
        resourceType: "User",
        resourceId: input.userId,
        ipAddress: requestIp(request),
      });
      return transaction.user.findUniqueOrThrow({
        where: { id: input.userId },
        select: { id: true, email: true, totpActivatedAt: true },
      });
    });
    return json(user);
  } catch (error) {
    return routeError(error);
  }
}
