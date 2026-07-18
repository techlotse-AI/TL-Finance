import { ApiError } from "@/lib/api/errors";
import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedSession } from "@/lib/auth/context";
import { verifyPassword } from "@/lib/auth/password";
import { hashRecoveryCode, looksLikeRecoveryCode } from "@/lib/auth/recovery-codes";
import { requestIp } from "@/lib/auth/request";
import { decryptSecret } from "@/lib/auth/secret-cipher";
import { totpDisableSchema } from "@/lib/auth/schemas";
import { verifyTotp } from "@/lib/auth/totp";
import { prisma } from "@/lib/db/prisma";

/**
 * Disables TOTP. Requires the account password AND a current second factor
 * (TOTP code or unused recovery code) so a hijacked session alone cannot
 * strip 2FA. Clears the secret, replay state, recovery codes, and any
 * outstanding challenges.
 */
export async function POST(request: Request) {
  try {
    const session = await requireAuthenticatedSession();
    const input = await readJson(request, totpDisableSchema);
    const now = new Date();

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session.userId },
      select: {
        id: true,
        passwordHash: true,
        totpSecretCiphertext: true,
        totpActivatedAt: true,
        totpLastUsedStep: true,
      },
    });
    if (!user.totpActivatedAt || !user.totpSecretCiphertext) {
      throw new ApiError(409, "totp_not_enabled", "Two-factor authentication is not enabled.");
    }

    if (!(await verifyPassword(input.password, user.passwordHash))) {
      throw new ApiError(401, "invalid_credentials", "Password is incorrect.");
    }

    let secondFactorValid = false;
    if (looksLikeRecoveryCode(input.code)) {
      const recovery = await prisma.totpRecoveryCode.findUnique({
        where: { userId_codeHash: { userId: user.id, codeHash: hashRecoveryCode(input.code) } },
        select: { id: true, usedAt: true },
      });
      secondFactorValid = Boolean(recovery && !recovery.usedAt);
    } else {
      secondFactorValid =
        verifyTotp(decryptSecret(user.totpSecretCiphertext), input.code, {
          now: Math.floor(now.getTime() / 1000),
          notBeforeStep: user.totpLastUsedStep,
        }) !== null;
    }
    if (!secondFactorValid) {
      throw new ApiError(401, "totp_code_invalid", "That code is not valid.");
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: user.id },
        data: { totpSecretCiphertext: null, totpActivatedAt: null, totpLastUsedStep: null },
      });
      await transaction.totpRecoveryCode.deleteMany({ where: { userId: user.id } });
      await transaction.totpChallenge.deleteMany({ where: { userId: user.id } });
      await writeAuditEvent(transaction, {
        userId: user.id,
        action: "auth.totp.disabled",
        resourceType: "User",
        resourceId: user.id,
        ipAddress: requestIp(request),
      });
    });

    return json({ enabled: false });
  } catch (error) {
    return routeError(error);
  }
}
