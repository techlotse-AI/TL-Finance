import { cookies } from "next/headers";

import { apiErrorResponse, ApiError } from "@/lib/api/errors";
import { writeAuditEvent } from "@/lib/audit/write";
import { assertTrustedOrigin } from "@/lib/auth/origin";
import { verifyPassword } from "@/lib/auth/password";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { requestIp } from "@/lib/auth/request";
import { signInSchema } from "@/lib/auth/schemas";
import {
  createSessionToken,
  hashSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  sessionCookieOptions,
} from "@/lib/auth/session-token";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    const ipAddress = requestIp(request);
    enforceRateLimit(`signin:${ipAddress ?? "unknown"}`, 10, 15 * 60 * 1000);
    const input = signInSchema.parse(await request.json());
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true, email: true, displayName: true, passwordHash: true, active: true },
    });
    const passwordValid = user ? await verifyPassword(input.password, user.passwordHash) : false;

    if (!user?.active || !passwordValid) {
      throw new ApiError(401, "invalid_credentials", "Email or password is incorrect.");
    }

    const token = createSessionToken();
    await prisma.$transaction(async (transaction) => {
      await transaction.session.create({
        data: {
          userId: user.id,
          tokenHash: hashSessionToken(token),
          expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
        },
      });
      await writeAuditEvent(transaction, {
        userId: user.id,
        action: "auth.signin",
        resourceType: "Session",
        ipAddress,
      });
    });

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, sessionCookieOptions);
    return Response.json({ user: { id: user.id, email: user.email, displayName: user.displayName } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
