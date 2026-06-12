import { describe, expect, it, vi } from "vitest";

import { shouldAssignInstanceAdmin } from "@/lib/auth/admin-bootstrap";

describe("instance administrator bootstrap", () => {
  it("assigns administrator access to the first user when no email is configured", async () => {
    expect(
      await shouldAssignInstanceAdmin({
        email: "first@example.com",
        configuredEmail: "",
        countUsers: async () => 0,
      }),
    ).toBe(true);
  });

  it("does not assign administrator access to later users when no email is configured", async () => {
    expect(
      await shouldAssignInstanceAdmin({
        email: "later@example.com",
        configuredEmail: undefined,
        countUsers: async () => 1,
      }),
    ).toBe(false);
  });

  it("reserves administrator access for a configured email", async () => {
    const countUsers = vi.fn(async () => 0);

    expect(
      await shouldAssignInstanceAdmin({
        email: "user@example.com",
        configuredEmail: " Admin@Example.com ",
        countUsers,
      }),
    ).toBe(false);
    expect(
      await shouldAssignInstanceAdmin({
        email: "admin@example.com",
        configuredEmail: " Admin@Example.com ",
        countUsers,
      }),
    ).toBe(true);
    expect(countUsers).not.toHaveBeenCalled();
  });
});
