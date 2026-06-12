import { createHmac } from "node:crypto";

import { ApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";

export async function enforceRateLimit(
  identifier: string,
  limit: number,
  windowMs: number,
  userId?: string,
): Promise<void> {
  const secret = process.env.RATE_LIMIT_HASH_SECRET ?? process.env.AUDIT_IP_HASH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("RATE_LIMIT_HASH_SECRET or AUDIT_IP_HASH_SECRET must be at least 32 characters.");
  }
  const separator = identifier.indexOf(":");
  const scope = separator === -1 ? identifier : identifier.slice(0, separator);
  const keyHash = createHmac("sha256", secret).update(identifier).digest("hex");
  const now = new Date();

  await prisma.$transaction(async (transaction) => {
    const current = await transaction.rateLimitBucket.findUnique({
      where: { scope_keyHash: { scope, keyHash } },
    });
    if (!current || current.windowEnds <= now) {
      await transaction.rateLimitBucket.upsert({
        where: { scope_keyHash: { scope, keyHash } },
        create: {
          scope,
          keyHash,
          userId,
          count: 1,
          windowEnds: new Date(now.getTime() + windowMs),
        },
        update: {
          userId,
          count: 1,
          windowEnds: new Date(now.getTime() + windowMs),
        },
      });
      return;
    }
    if (current.count >= limit) {
      throw new ApiError(429, "rate_limited", "Too many requests. Try again later.");
    }
    await transaction.rateLimitBucket.update({
      where: { id: current.id },
      data: { count: { increment: 1 }, userId: userId ?? current.userId },
    });
  }, { isolationLevel: "Serializable" });
}
