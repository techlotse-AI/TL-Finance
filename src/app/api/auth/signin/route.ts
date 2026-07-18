import { cookies } from "next/headers";

import { apiErrorResponse, ApiError } from "@/lib/api/errors";
import { writeAuditEvent } from "@/lib/audit/write";
import { DEVICE_COOKIE_NAME, deviceCookieOptions } from "@/lib/auth/devices";
import { establishSession } from "@/lib/auth/establish-session";
import { isLocked, lockoutPolicyFromEnv, registerFailedAttempt } from "@/lib/auth/lockout";
import { assertTrustedOrigin } from "@/lib/auth/origin";
import { verifyPassword } from "@/lib/auth/password";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { requestIp } from "@/lib/auth/request";
import { signInSchema } from "@/lib/auth/schemas";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth/session-token";
import { createOneTimeToken, hashOneTimeToken, TOTP_CHALLENGE_TTL_SECONDS } from "@/lib/auth/tokens";
import { prisma } from "@/lib/db/prisma";

// One generic error for every credential/lockout failure so that a locked
// account is indistinguishable from a wrong password (no account enumeration).
function invalidCredentials(): ApiError {
  return new ApiError(401, "invalid_credentials", "Email or password is incorrect.");
}

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    const ipAddress = requestIp(request);
    await enforceRateLimit(`signin:${ipAddress ?? "unknown"}`, 10, 15 * 60 * 1000);
    const input = signInSchema.parse(await request.json());
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: {
        id: true,
        email: true,
        displayName: true,
        passwordHash: true,
        active: true,
        emailVerifiedAt: true,
        failedLoginCount: true,
        lockedUntil: true,
        totpActivatedAt: true,
      },
    });
    const now = new Date();

    // Locked account: never check the password; audit and return the generic error.
    if (user?.active && isLocked(user, now)) {
      await writeAuditEvent(prisma, {
        userId: user.id,
        action: "auth.signin.locked",
        resourceType: "Session",
        ipAddress,
      });
      throw invalidCredentials();
    }

    const passwordValid = user ? await verifyPassword(input.password, user.passwordHash) : false;

    if (!user?.active || !passwordValid) {
      // Track failed attempts only for an existing active account so the lockout
      // cannot be used to probe which emails exist.
      if (user?.active) {
        const next = registerFailedAttempt(user.failedLoginCount, now, lockoutPolicyFromEnv());
        await prisma.$transaction(async (transaction) => {
          await transaction.user.update({
            where: { id: user.id },
            data: {
              failedLoginCount: next.failedLoginCount,
              lockedUntil: next.lockedUntil,
              lastFailedLoginAt: now,
            },
          });
          await writeAuditEvent(transaction, {
            userId: user.id,
            action: "auth.signin.failed",
            resourceType: "Session",
            metadata: { failedLoginCount: next.failedLoginCount },
            ipAddress,
          });
          if (next.newlyLocked) {
            await writeAuditEvent(transaction, {
              userId: user.id,
              action: "auth.account.locked",
              resourceType: "User",
              resourceId: user.id,
              metadata: { lockedUntil: next.lockedUntil?.toISOString() ?? null },
              ipAddress,
            });
          }
        });
      }
      throw invalidCredentials();
    }

    if (process.env.EMAIL_VERIFICATION_REQUIRED === "true" && !user.emailVerifiedAt) {
      throw new ApiError(403, "email_verification_required", "Verify your email address before signing in.");
    }

    // Second factor: a correct password is not a session when TOTP is active.
    // Issue a short-lived challenge instead; the /api/auth/totp/challenge
    // route completes the sign-in. Lockout state is intentionally NOT cleared
    // here — only a fully completed sign-in clears it.
    if (user.totpActivatedAt) {
      const challengeToken = createOneTimeToken();
      await prisma.totpChallenge.create({
        data: {
          userId: user.id,
          tokenHash: hashOneTimeToken(challengeToken),
          expiresAt: new Date(Date.now() + TOTP_CHALLENGE_TTL_SECONDS * 1000),
        },
      });
      return Response.json({ totpRequired: true, challenge: challengeToken });
    }

    const cookieStore = await cookies();
    const { sessionToken, device } = await establishSession({
      user,
      ipAddress,
      deviceToken: cookieStore.get(DEVICE_COOKIE_NAME)?.value ?? null,
      userAgent: request.headers.get("user-agent"),
      totpUsed: false,
    });
    cookieStore.set(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions);
    cookieStore.set(DEVICE_COOKIE_NAME, device.deviceToken, deviceCookieOptions);
    return Response.json({ user: { id: user.id, email: user.email, displayName: user.displayName } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
