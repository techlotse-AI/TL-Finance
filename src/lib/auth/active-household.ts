import { prisma } from "@/lib/db/prisma";

/** A household membership candidate for becoming the session's active household. */
export interface MembershipCandidate {
  householdId: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  active: boolean;
  householdActive: boolean;
  createdAt: Date;
}

const ROLE_PRIORITY: Record<MembershipCandidate["role"], number> = { OWNER: 0, ADMIN: 1, MEMBER: 2 };

/**
 * Pick the household a user should land in when their session has no active
 * household yet. Considers only active memberships of active households, then
 * prefers ownership, then the oldest membership for stability. Returns null when
 * the user belongs to no usable household (genuine onboarding case).
 *
 * Pure and deterministic so the post-login routing decision is unit-tested.
 */
export function pickDefaultHouseholdId(memberships: MembershipCandidate[]): string | null {
  const usable = memberships.filter((membership) => membership.active && membership.householdActive);
  if (usable.length === 0) return null;
  usable.sort((left, right) => {
    if (ROLE_PRIORITY[left.role] !== ROLE_PRIORITY[right.role]) {
      return ROLE_PRIORITY[left.role] - ROLE_PRIORITY[right.role];
    }
    return left.createdAt.getTime() - right.createdAt.getTime();
  });
  return usable[0].householdId;
}

/**
 * Resolve the default active household for a user from the database. Used at
 * sign-in (to seed the session) and as a self-healing fallback for older
 * sessions whose `activeHouseholdId` is null.
 */
export async function defaultHouseholdIdForUser(userId: string): Promise<string | null> {
  const memberships = await prisma.householdMember.findMany({
    where: { userId, active: true, household: { active: true } },
    select: { householdId: true, role: true, active: true, createdAt: true, household: { select: { active: true } } },
  });
  return pickDefaultHouseholdId(
    memberships.map((membership) => ({
      householdId: membership.householdId,
      role: membership.role,
      active: membership.active,
      householdActive: membership.household.active,
      createdAt: membership.createdAt,
    })),
  );
}

/**
 * Ensure the session has an active household when the user has one available.
 * If the session's active household is missing, this resolves a default and
 * persists it on the session, returning the resulting id (or null when the user
 * truly has no household and should be onboarded).
 */
export async function ensureActiveHousehold(
  sessionId: string,
  userId: string,
  currentActiveHouseholdId: string | null,
): Promise<string | null> {
  if (currentActiveHouseholdId) return currentActiveHouseholdId;
  const resolved = await defaultHouseholdIdForUser(userId);
  if (resolved) {
    await prisma.session.update({ where: { id: sessionId }, data: { activeHouseholdId: resolved } });
  }
  return resolved;
}
