import { writeAuditEvent } from "@/lib/audit/write";
import { defaultHouseholdIdForUser } from "@/lib/auth/active-household";
import { registerSignInDevice, type RegisterDeviceResult } from "@/lib/auth/devices";
import { createSessionToken, hashSessionToken, SESSION_TTL_SECONDS } from "@/lib/auth/session-token";
import { prisma } from "@/lib/db/prisma";

/**
 * The single, shared final step of every successful sign-in — used by the
 * password route (no TOTP enrolled) and the TOTP challenge route (second
 * factor verified). Creates the session, clears lockout state, audits
 * `auth.signin`, then records the device and sends the new-device alert.
 * Device handling runs after the session transaction and is best-effort: a
 * mailer or device failure never rolls back an established session.
 */
export async function establishSession(input: {
  user: { id: string; email: string; failedLoginCount: number; lockedUntil: Date | null };
  ipAddress: string | null | undefined;
  deviceToken: string | null;
  userAgent: string | null;
  totpUsed: boolean;
}): Promise<{ sessionToken: string; device: RegisterDeviceResult }> {
  const activeHouseholdId = await defaultHouseholdIdForUser(input.user.id);
  const sessionToken = createSessionToken();

  await prisma.$transaction(async (transaction) => {
    await transaction.session.create({
      data: {
        userId: input.user.id,
        tokenHash: hashSessionToken(sessionToken),
        activeHouseholdId,
        expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
      },
    });
    if (input.user.failedLoginCount > 0 || input.user.lockedUntil) {
      await transaction.user.update({
        where: { id: input.user.id },
        data: { failedLoginCount: 0, lockedUntil: null },
      });
    }
    await writeAuditEvent(transaction, {
      userId: input.user.id,
      action: "auth.signin",
      resourceType: "Session",
      metadata: input.totpUsed ? { totp: true } : undefined,
      ipAddress: input.ipAddress,
    });
  });

  let device: RegisterDeviceResult;
  try {
    device = await registerSignInDevice(prisma, {
      userId: input.user.id,
      email: input.user.email,
      deviceToken: input.deviceToken,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
    });
  } catch (error) {
    // Never block a sign-in on device bookkeeping; re-issue the incoming
    // token (or none) so the cookie state stays consistent.
    console.error("Device registration failed:", error);
    device = { deviceToken: input.deviceToken ?? createSessionToken(), newDevice: false, alerted: false };
  }

  return { sessionToken, device };
}
