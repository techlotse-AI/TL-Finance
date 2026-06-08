import { describe, expect, it } from "vitest";

import { userBackupSchema } from "@/lib/backups/user-backup";

describe("userBackupSchema", () => {
  it("accepts a portable backup without credentials or sessions", () => {
    const parsed = userBackupSchema.parse({
      format: "tl-finance-user-backup",
      version: 1,
      exportedAt: "2026-06-07T12:00:00.000Z",
      user: {
        displayName: "Example",
        passwordHash: "must-not-be-imported",
      },
      households: [],
      sessions: ["must-not-be-imported"],
    });

    expect(parsed).toEqual({
      format: "tl-finance-user-backup",
      version: 1,
      exportedAt: "2026-06-07T12:00:00.000Z",
      user: { displayName: "Example" },
      households: [],
    });
  });
});
