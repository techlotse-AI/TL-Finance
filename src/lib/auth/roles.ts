export type HouseholdRole = "owner" | "admin" | "member";

const roleRank: Record<HouseholdRole, number> = {
  member: 1,
  admin: 2,
  owner: 3,
};

export function hasRequiredRole(actual: HouseholdRole, required: HouseholdRole): boolean {
  return roleRank[actual] >= roleRank[required];
}

export function requireRole(actual: HouseholdRole, required: HouseholdRole): void {
  if (!hasRequiredRole(actual, required)) {
    throw new Error(`The ${required} household role is required.`);
  }
}
