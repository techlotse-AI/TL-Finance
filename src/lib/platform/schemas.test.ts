import { describe, expect, it } from "vitest";

import { adminUserUpdateSchema, databaseResetSchema } from "@/lib/platform/schemas";

describe("platform mutation schemas", () => {
  it("requires the exact destructive reset confirmation", () => {
    expect(databaseResetSchema.safeParse({
      confirmation: "reset platform database",
      password: "password",
    }).success).toBe(false);
    expect(databaseResetSchema.safeParse({
      confirmation: "RESET PLATFORM DATABASE",
      password: "password",
    }).success).toBe(true);
  });

  it("requires explicit user-management state", () => {
    expect(adminUserUpdateSchema.safeParse({
      userId: "user-id",
      active: true,
      instanceAdmin: false,
    }).success).toBe(true);
    expect(adminUserUpdateSchema.safeParse({
      userId: "user-id",
      active: true,
    }).success).toBe(false);
  });
});
