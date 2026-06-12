import { afterAll, describe, expect, it } from "vitest";

import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { prisma } from "@/lib/db/prisma";

const suite = process.env.DATABASE_URL ? describe : describe.skip;
const marker = `rate-limit-${Date.now()}`;

suite("shared authentication rate limit", () => {
  afterAll(async () => {
    await prisma.rateLimitBucket.deleteMany({ where: { scope: marker } });
  });

  it("persists and enforces a shared window", async () => {
    await enforceRateLimit(`${marker}:identifier`, 2, 60_000);
    await enforceRateLimit(`${marker}:identifier`, 2, 60_000);
    await expect(enforceRateLimit(`${marker}:identifier`, 2, 60_000)).rejects.toMatchObject({
      status: 429,
      code: "rate_limited",
    });
    expect(await prisma.rateLimitBucket.count({ where: { scope: marker } })).toBe(1);
  });
});
