import { createHmac } from "node:crypto";

export function hashIpAddress(ipAddress: string | null): string | null {
  if (!ipAddress) {
    return null;
  }

  const secret = process.env.AUDIT_IP_HASH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("AUDIT_IP_HASH_SECRET must be at least 32 characters.");
  }

  return createHmac("sha256", secret).update(ipAddress).digest("hex");
}
