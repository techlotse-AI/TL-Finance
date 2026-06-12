import { cookies } from "next/headers";

import { ApiError } from "@/lib/api/errors";
import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { hashPassword } from "@/lib/auth/password";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { requestIp } from "@/lib/auth/request";
import { passwordResetCompleteSchema } from "@/lib/auth/schemas";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-token";
import { hashOneTimeToken } from "@/lib/auth/tokens";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request) {
  try {
    await enforceRateLimit(`reset-complete:${requestIp(request) ?? "unknown"}`, 10, 15 * 60 * 1000);
    const input = await readJson(request, passwordResetCompleteSchema);
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashOneTimeToken(input.token) },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });
    if (!record || record.usedAt || record.expiresAt <= new Date()) {
      throw new ApiError(400, "invalid_token", "This password-reset link is invalid or expired.");
    }
    const passwordHash = await hashPassword(input.password);
    await prisma.$transaction(async (transaction) => {
      await transaction.user.update({ where: { id: record.userId }, data: { passwordHash } });
      await transaction.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
      await transaction.session.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await writeAuditEvent(transaction, { userId: record.userId, action: "auth.password_reset.complete", resourceType: "User", resourceId: record.userId, ipAddress: requestIp(request) });
    });
    (await cookies()).delete(SESSION_COOKIE_NAME);
    return json({ reset: true });
  } catch (error) {
    return routeError(error);
  }
}
