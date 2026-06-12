import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { requestIp } from "@/lib/auth/request";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { tokenCompleteSchema } from "@/lib/auth/schemas";
import { hashOneTimeToken } from "@/lib/auth/tokens";
import { ApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request) {
  try {
    await enforceRateLimit(`verify-complete:${requestIp(request) ?? "unknown"}`, 10, 15 * 60 * 1000);
    const input = await readJson(request, tokenCompleteSchema);
    const record = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash: hashOneTimeToken(input.token) },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });
    if (!record || record.usedAt || record.expiresAt <= new Date()) {
      throw new ApiError(400, "invalid_token", "This verification link is invalid or expired.");
    }
    await prisma.$transaction(async (transaction) => {
      await transaction.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } });
      await transaction.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
      await writeAuditEvent(transaction, { userId: record.userId, action: "auth.email_verification.complete", resourceType: "User", resourceId: record.userId, ipAddress: requestIp(request) });
    });
    return json({ verified: true });
  } catch (error) {
    return routeError(error);
  }
}
