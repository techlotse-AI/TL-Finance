import { describe, expect, it } from "vitest";

import { adminPasswordResetSchema } from "@/lib/platform/schemas";
import { selectBulkResetUserIds } from "@/lib/platform/admin-users";

describe("selectBulkResetUserIds", () => {
  const users = [
    { id: "u1", active: true, instanceAdmin: false },
    { id: "u2", active: true, instanceAdmin: true }, // admin, excluded
    { id: "u3", active: false, instanceAdmin: false }, // inactive, excluded
    { id: "admin", active: true, instanceAdmin: true },
  ];

  it("returns only active non-admin users, excluding the actor", () => {
    expect(selectBulkResetUserIds(users, "admin")).toEqual(["u1"]);
  });

  it("excludes the acting user even if they were non-admin", () => {
    expect(selectBulkResetUserIds([{ id: "self", active: true, instanceAdmin: false }], "self")).toEqual([]);
  });
});

describe("adminPasswordResetSchema", () => {
  it("accepts a single-user reset with a strong password", () => {
    const parsed = adminPasswordResetSchema.parse({ userId: "user-123", newPassword: "Sup3rSecret!!" });
    expect(parsed.userId).toBe("user-123");
  });

  it("accepts a bulk reset", () => {
    const parsed = adminPasswordResetSchema.parse({ allNonAdmin: true, newPassword: "Sup3rSecret!!" });
    expect(parsed.allNonAdmin).toBe(true);
  });

  it("rejects providing both userId and allNonAdmin", () => {
    expect(() => adminPasswordResetSchema.parse({ userId: "u1", allNonAdmin: true, newPassword: "Sup3rSecret!!" })).toThrow();
  });

  it("rejects providing neither target", () => {
    expect(() => adminPasswordResetSchema.parse({ newPassword: "Sup3rSecret!!" })).toThrow();
  });

  it("rejects a weak password", () => {
    expect(() => adminPasswordResetSchema.parse({ userId: "u1", newPassword: "weak" })).toThrow();
  });
});
