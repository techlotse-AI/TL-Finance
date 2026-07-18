import { ApiError } from "@/lib/api/errors";
import { json, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedSession } from "@/lib/auth/context";
import { assertTrustedOrigin } from "@/lib/auth/origin";
import { requestIp } from "@/lib/auth/request";
import { encryptSecret, secretCipherConfigured } from "@/lib/auth/secret-cipher";
import { generateTotpSecret, otpauthUri } from "@/lib/auth/totp";
import { prisma } from "@/lib/db/prisma";

/**
 * Starts TOTP enrollment: generates a secret, stores it encrypted with
 * activation pending, and returns the secret + otpauth URI exactly once for
 * the authenticator app. Nothing is enforced until /activate proves the user
 * actually captured the secret. Re-posting replaces a pending secret;
 * an already-active credential must be disabled first.
 */
export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    const session = await requireAuthenticatedSession();

    if (!secretCipherConfigured()) {
      throw new ApiError(
        503,
        "totp_not_configured",
        "Two-factor authentication is not configured on this server (TOTP_ENCRYPTION_KEY).",
      );
    }

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session.userId },
      select: { id: true, email: true, totpActivatedAt: true },
    });
    if (user.totpActivatedAt) {
      throw new ApiError(409, "totp_already_enabled", "Two-factor authentication is already enabled. Disable it before re-enrolling.");
    }

    const secret = generateTotpSecret();
    await prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: user.id },
        data: {
          totpSecretCiphertext: encryptSecret(secret),
          totpActivatedAt: null,
          totpLastUsedStep: null,
        },
      });
      await writeAuditEvent(transaction, {
        userId: user.id,
        action: "auth.totp.enroll_started",
        resourceType: "User",
        resourceId: user.id,
        ipAddress: requestIp(request),
      });
    });

    return json({ secret, otpauthUri: otpauthUri(secret, user.email) });
  } catch (error) {
    return routeError(error);
  }
}
