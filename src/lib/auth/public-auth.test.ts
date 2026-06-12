import { describe, expect, it } from "vitest";

import { passwordResetCompleteSchema } from "@/lib/auth/schemas";
import { createOneTimeToken, hashOneTimeToken } from "@/lib/auth/tokens";

describe("public authentication primitives", () => {
  it("stores one-time token hashes rather than raw tokens", () => {
    const token = createOneTimeToken();
    const hash = hashOneTimeToken(token);
    expect(token).not.toBe(hash);
    expect(hash).toHaveLength(64);
    expect(hashOneTimeToken(token)).toBe(hash);
  });

  it("requires the strong password policy during reset", () => {
    expect(passwordResetCompleteSchema.safeParse({ token: "x".repeat(32), password: "weak" }).success).toBe(false);
    expect(passwordResetCompleteSchema.safeParse({ token: "x".repeat(32), password: "StrongPassword123" }).success).toBe(true);
  });
});
