import { createHash, randomBytes } from "node:crypto";

import type { PrismaClient } from "@prisma/client";

import { writeAuditEvent } from "@/lib/audit/write";
import { mailConfigured, sendAccountMail } from "@/lib/mail/smtp";

/**
 * New-device sign-in alerts. A device is identified by a long-lived random
 * cookie (not a fingerprint — no user-agent/IP heuristics for identity, which
 * would be both spoofable and privacy-hostile). The cookie value is stored
 * only hashed (sha256 hex), same as session tokens. A successful sign-in
 * whose device hash has no KnownDevice row is a "new device": it is recorded
 * and, unless it is the account's very first device (first-ever sign-in
 * would otherwise always alert), an alert email is sent and an
 * `auth.new_device` security event is written.
 *
 * Clearing cookies makes a browser a "new device" again — that is the
 * correct fail-direction for an alerting feature (alert too often rather
 * than too rarely).
 */

export const DEVICE_COOKIE_NAME = "tl_finance_device";
/** 400 days — the maximum cookie lifetime Chromium enforces. */
export const DEVICE_COOKIE_TTL_SECONDS = 60 * 60 * 24 * 400;

export const deviceCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: DEVICE_COOKIE_TTL_SECONDS,
};

export function createDeviceToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Truncates for the VarChar(255) column; informational only, never parsed. */
export function truncateUserAgent(userAgent: string | null): string | null {
  if (!userAgent) return null;
  const cleaned = userAgent.trim();
  return cleaned.length > 255 ? cleaned.slice(0, 255) : cleaned || null;
}

export interface RegisterDeviceInput {
  userId: string;
  email: string;
  /** The incoming device cookie value, if any. */
  deviceToken: string | null;
  userAgent: string | null;
  ipAddress: string | null | undefined;
}

export interface RegisterDeviceResult {
  /** The token the caller must (re-)set as the device cookie. */
  deviceToken: string;
  newDevice: boolean;
  alerted: boolean;
}

/**
 * Records the sign-in device and sends the new-device alert when warranted.
 * Best-effort by design: any failure here must never block a sign-in — the
 * caller invokes this after the session exists and swallows nothing itself.
 */
export async function registerSignInDevice(
  client: PrismaClient,
  input: RegisterDeviceInput,
): Promise<RegisterDeviceResult> {
  const token = input.deviceToken ?? createDeviceToken();
  const deviceHash = hashDeviceToken(token);
  const now = new Date();

  const existing = await client.knownDevice.findUnique({
    where: { userId_deviceHash: { userId: input.userId, deviceHash } },
    select: { id: true },
  });

  if (existing) {
    await client.knownDevice.update({ where: { id: existing.id }, data: { lastSeenAt: now } });
    return { deviceToken: token, newDevice: false, alerted: false };
  }

  const priorDevices = await client.knownDevice.count({ where: { userId: input.userId } });
  await client.knownDevice.create({
    data: {
      userId: input.userId,
      deviceHash,
      userAgent: truncateUserAgent(input.userAgent),
      lastSeenAt: now,
    },
  });

  // The account's first-ever device is recorded silently — alerting on the
  // sign-in that follows signup would train users to ignore the alert.
  if (priorDevices === 0) {
    return { deviceToken: token, newDevice: true, alerted: false };
  }

  await writeAuditEvent(client, {
    userId: input.userId,
    action: "auth.new_device",
    resourceType: "User",
    resourceId: input.userId,
    metadata: { userAgent: truncateUserAgent(input.userAgent) },
    ipAddress: input.ipAddress,
  });

  let alerted = false;
  if (mailConfigured()) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    try {
      await sendAccountMail({
        to: input.email,
        subject: "New sign-in to your TL Finance account",
        text: [
          "Your TL Finance account was just signed in to from a device we haven't seen before.",
          "",
          `Time: ${now.toISOString()}`,
          `Device: ${truncateUserAgent(input.userAgent) ?? "unknown"}`,
          "",
          "If this was you, no action is needed.",
          "",
          "If this was NOT you, reset your password immediately — this revokes",
          "every active session:",
          appUrl ? `${appUrl}/forgot-password` : "(open the app and use Forgot password)",
        ].join("\n"),
      });
      alerted = true;
    } catch (error) {
      // Alerting is best-effort; the sign-in itself must not fail.
      console.error("New-device alert email failed:", error);
    }
  }

  return { deviceToken: token, newDevice: true, alerted };
}
