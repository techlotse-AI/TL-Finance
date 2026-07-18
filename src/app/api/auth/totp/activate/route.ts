import { ApiError } from "@/lib/api/errors";
import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedSession } from "@/lib/auth/context";
import { generateRecoveryCodes, hashRecoveryCode } from "@/lib/auth/recovery-codes";
import { requestIp } from "@/lib/auth/request";
import { decryptSecret } from "@/lib/auth/secret-cipher";
import { totpActivateSchema } from "@/lib/auth/schemas";
import { verifyTotp } from "@/lib/auth/totp";
import { prisma } from "@/lib/db/prisma";

/**
 * Completes enrollment: the user proves possession of the pending secret with
 * a current code. On success TOTP becomes enforced on every future sign-in
 * and the one-time recovery codes are returned — plaintext exactly once,
 * stored only hashed.
 */
export async function POST(request: Request) {
  try {
    const session = await requireAuthenticatedSession();
    const input = await readJson(request, totpActivateSchema);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session.userId },
      select: { id: true, totpSecretCiphertext: true, totpActivatedAt: true },
    });
    if (user.totpActivatedAt) {
      throw new ApiError(409, "totp_already_enabled", "Two-factor authentication is already enabled.");
    }
    if (!user.totpSecretCiphertext) {
      throw new ApiError(409, "totp_not_enrolled", "Start enrollment first.");
    }

    const secret = decryptSecret(user.totpSecretCiphertext);
    const matchedStep = verifyTotp(secret, input.code, { now: Math.floor(Date.now() / 1000) });
    if (matchedStep === null) {
      throw new ApiError(400, "totp_code_invalid", "That code is not valid. Check the authenticator app and try again.");
    }

    const recoveryCodes = generateRecoveryCodes();
    await prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: user.id },
        data: { totpActivatedAt: new Date(), totpLastUsedStep: matchedStep },
      });
      await transaction.totpRecoveryCode.deleteMany({ where: { userId: user.id } });
      await transaction.totpRecoveryCode.createMany({
        data: recoveryCodes.map((code) => ({ userId: user.id, codeHash: hashRecoveryCode(code) })),
      });
      await writeAuditEvent(transaction, {
        userId: user.id,
        action: "auth.totp.enabled",
        resourceType: "User",
        resourceId: user.id,
        ipAddress: requestIp(request),
      });
    });

    return json({ enabled: true, recoveryCodes });
  } catch (error) {
    return routeError(error);
  }
}
