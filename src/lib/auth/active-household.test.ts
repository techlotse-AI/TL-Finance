import { describe, expect, it } from "vitest";

import { pickDefaultHouseholdId, type MembershipCandidate } from "@/lib/auth/active-household";

function membership(overrides: Partial<MembershipCandidate>): MembershipCandidate {
  return {
    householdId: "h1",
    role: "MEMBER",
    active: true,
    householdActive: true,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("pickDefaultHouseholdId", () => {
  it("returns null when there are no memberships (genuine onboarding)", () => {
    expect(pickDefaultHouseholdId([])).toBeNull();
  });

  it("ignores inactive memberships and inactive households", () => {
    expect(
      pickDefaultHouseholdId([
        membership({ householdId: "inactive-member", active: false }),
        membership({ householdId: "inactive-household", householdActive: false }),
      ]),
    ).toBeNull();
  });

  it("returns the single usable household", () => {
    expect(pickDefaultHouseholdId([membership({ householdId: "only" })])).toBe("only");
  });

  it("prefers ownership over admin and member roles", () => {
    const result = pickDefaultHouseholdId([
      membership({ householdId: "member", role: "MEMBER", createdAt: new Date("2025-01-01T00:00:00Z") }),
      membership({ householdId: "owner", role: "OWNER", createdAt: new Date("2026-06-01T00:00:00Z") }),
      membership({ householdId: "admin", role: "ADMIN", createdAt: new Date("2025-06-01T00:00:00Z") }),
    ]);
    expect(result).toBe("owner");
  });

  it("breaks ties by the oldest membership", () => {
    const result = pickDefaultHouseholdId([
      membership({ householdId: "newer", role: "MEMBER", createdAt: new Date("2026-05-01T00:00:00Z") }),
      membership({ householdId: "older", role: "MEMBER", createdAt: new Date("2026-01-01T00:00:00Z") }),
    ]);
    expect(result).toBe("older");
  });
});
