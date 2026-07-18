import { cookies } from "next/headers";

import { ApiError } from "@/lib/api/errors";
import { readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { DEVICE_COOKIE_NAME, deviceCookieOptions } from "@/lib/auth/devices";
import { establishSession } from "@/lib/auth/establish-session";
import { isLocked, lockoutPolicyFromEnv, registerFailedAttempt } from "@/lib/auth/lockout";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { hashRecoveryCode, looksLikeRecoveryCode } from "@/lib/auth/recovery-codes";
import { requestIp } from "@/lib/auth/request";
import { decryptSecret } from "@/lib/auth/secret-cipher";
import { totpChallengeSchema } from "@/lib/auth/schemas";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth/session-token";
import { hashOneTimeToken } from "@/lib/auth/tokens";
import { verifyTotp } from "@/lib/auth/totp";
import { prisma } from "@/lib/db/prisma";

/**
 * Second-factor step: exchanges a valid signin-issued challenge plus a TOTP
 * code (or a one-time recovery code) for a session. Failed codes feed the
 * same escalating account lockout as failed passwords, and accepted TOTP
 * steps are persisted so a captured code can never be replayed.
 */
export async function POST(request: Request) {
  try {
    const ipAddress = requestIp(request);
    await enforceRateLimit(`totp:${ipAddress ?? "unknown"}`, 10, 15 * 60 * 1000);
    const input = await readJson(request, totpChallengeSchema);
    const now = new Date();

    const challenge = await prisma.totpChallenge.findUnique({
      where: { tokenHash: hashOneTimeToken(input.challenge) },
      select: {
        id: true,
        expiresAt: true,
        consumedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            active: true,
            failedLoginCount: true,
            lockedUntil: true,
            totpSecretCiphertext: true,
            totpActivatedAt: true,
            totpLastUsedStep: true,
          },
        },
      },
    });

    const expired = new ApiError(401, "totp_challenge_invalid", "The sign-in expired. Enter your password again.");
    if (!challenge || challenge.consumedAt || challenge.expiresAt < now) throw expired;

    const user = challenge.user;
    if (!user.active || !user.totpActivatedAt || !user.totpSecretCiphertext) throw expired;

    if (isLocked(user, now)) {
      await writeAuditEvent(prisma, {
        userId: user.id,
        action: "auth.signin.locked",
        resourceType: "Session",
        ipAddress,
      });
      throw expired;
    }

    // Recovery-code path (10-char code) or TOTP path (6 digits).
    let recoveryCodeId: string | null = null;
    let matchedStep: bigint | null = null;
    if (looksLikeRecoveryCode(input.code)) {
      const recovery = await prisma.totpRecoveryCode.findUnique({
        where: { userId_codeHash: { userId: user.id, codeHash: hashRecoveryCode(input.code) } },
        select: { id: true, usedAt: true },
      });
      if (recovery && !recovery.usedAt) recoveryCodeId = recovery.id;
    } else {
      matchedStep = verifyTotp(decryptSecret(user.totpSecretCiphertext), input.code, {
        now: Math.floor(now.getTime() / 1000),
        notBeforeStep: user.totpLastUsedStep,
      });
    }

    if (recoveryCodeId === null && matchedStep === null) {
      // Wrong second factor: escalate the same lockout as a wrong password.
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
          action: "auth.totp.failed",
          resourceType: "User",
          resourceId: user.id,
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
      throw new ApiError(401, "totp_code_invalid", "That code is not valid.");
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.totpChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: now },
      });
      if (matchedStep !== null) {
        await transaction.user.update({
          where: { id: user.id },
          data: { totpLastUsedStep: matchedStep },
        });
      }
      if (recoveryCodeId !== null) {
        await transaction.totpRecoveryCode.update({
          where: { id: recoveryCodeId },
          data: { usedAt: now },
        });
        await writeAuditEvent(transaction, {
          userId: user.id,
          action: "auth.totp.recovery_used",
          resourceType: "User",
          resourceId: user.id,
          ipAddress,
        });
      }
    });

    const cookieStore = await cookies();
    const { sessionToken, device } = await establishSession({
      user,
      ipAddress,
      deviceToken: cookieStore.get(DEVICE_COOKIE_NAME)?.value ?? null,
      userAgent: request.headers.get("user-agent"),
      totpUsed: true,
    });
    cookieStore.set(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions);
    cookieStore.set(DEVICE_COOKIE_NAME, device.deviceToken, deviceCookieOptions);
    return Response.json({ user: { id: user.id, email: user.email, displayName: user.displayName } });
  } catch (error) {
    return routeError(error);
  }
}
