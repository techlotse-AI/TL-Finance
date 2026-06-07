import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import { assertTrustedOrigin } from "@/lib/auth/origin";
import { hasRequiredRole } from "@/lib/auth/roles";
import { createSessionToken, hashSessionToken } from "@/lib/auth/session-token";

describe("authentication security primitives", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("stores a stable session hash rather than the raw token", () => {
    const token = createSessionToken();
    const tokenHash = hashSessionToken(token);

    expect(token).not.toBe(tokenHash);
    expect(tokenHash).toHaveLength(64);
    expect(hashSessionToken(token)).toBe(tokenHash);
  });

  it("enforces the household role hierarchy", () => {
    expect(hasRequiredRole("owner", "admin")).toBe(true);
    expect(hasRequiredRole("admin", "member")).toBe(true);
    expect(hasRequiredRole("member", "admin")).toBe(false);
  });

  it("rejects missing, malformed, and cross-origin unsafe requests as forbidden", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://finance.example");

    for (const origin of [undefined, "not-a-url", "https://attacker.example"]) {
      const request = new Request("https://finance.example/api/test", {
        method: "POST",
        headers: origin ? { origin } : undefined,
      });

      expect(() => assertTrustedOrigin(request)).toThrowError(
        expect.objectContaining<Partial<ApiError>>({
          status: 403,
          code: "untrusted_origin",
        }),
      );
    }
  });
});
