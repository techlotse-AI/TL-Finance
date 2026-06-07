import type { Capability, ProductTier } from "@/lib/entitlements/capabilities";
import { cookies } from "next/headers";

import { ApiError } from "@/lib/api/errors";
import { hashSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session-token";
import { hasCapability } from "@/lib/entitlements/capabilities";
import { prisma } from "@/lib/db/prisma";

export interface AuthenticatedSession {
  userId: string;
  sessionId: string;
  activeHouseholdId: string | null;
  instanceAdmin: boolean;
}

export interface AuthenticatedContext {
  userId: string;
  sessionId: string;
  householdId: string;
  role: "owner" | "admin" | "member";
  tier: ProductTier;
  instanceAdmin: boolean;
}

export async function requireAuthenticatedSession(): Promise<AuthenticatedSession> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    throw new ApiError(401, "unauthenticated", "Authentication is required.");
  }

  const session = await prisma.session.findFirst({
    where: {
      tokenHash: hashSessionToken(token),
      revokedAt: null,
      expiresAt: { gt: new Date() },
      user: { active: true },
    },
    select: {
      id: true,
      userId: true,
      activeHouseholdId: true,
      user: { select: { instanceAdmin: true } },
      activeHousehold: {
        select: {
          active: true,
          entitlement: { select: { tier: true, active: true, expiresAt: true } },
        },
      },
    },
  });

  if (!session) {
    throw new ApiError(401, "unauthenticated", "Authentication is required.");
  }

  return {
    userId: session.userId,
    sessionId: session.id,
    activeHouseholdId: session.activeHouseholdId,
    instanceAdmin: session.user.instanceAdmin,
  };
}

export async function requireAuthenticatedContext(
  capability?: Capability,
): Promise<AuthenticatedContext> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    throw new ApiError(401, "unauthenticated", "Authentication is required.");
  }

  const session = await prisma.session.findFirst({
    where: {
      tokenHash: hashSessionToken(token),
      revokedAt: null,
      expiresAt: { gt: new Date() },
      user: { active: true },
    },
    select: {
      id: true,
      userId: true,
      activeHouseholdId: true,
      user: { select: { instanceAdmin: true } },
      activeHousehold: {
        select: {
          active: true,
          entitlement: { select: { tier: true, active: true, expiresAt: true } },
        },
      },
    },
  });

  if (!session) {
    throw new ApiError(401, "unauthenticated", "Authentication is required.");
  }

  if (!session.activeHouseholdId || !session.activeHousehold?.active) {
    throw new ApiError(409, "active_household_required", "Select an active household.");
  }

  const membership = await prisma.householdMember.findUnique({
    where: {
      householdId_userId: {
        householdId: session.activeHouseholdId,
        userId: session.userId,
      },
    },
    select: { active: true, role: true },
  });

  if (!membership?.active) {
    throw new ApiError(403, "forbidden", "Household access is not available.");
  }

  const entitlement = session.activeHousehold.entitlement;
  const tier = entitlementIsActive(entitlement)
    ? entitlement.tier.toLowerCase() as ProductTier
    : "budget";

  if (capability && !hasCapability(tier, capability, session.user.instanceAdmin)) {
    throw new ApiError(403, "entitlement_required", "This household tier does not provide access.");
  }

  return {
    userId: session.userId,
    sessionId: session.id,
    householdId: session.activeHouseholdId,
    role: membership.role.toLowerCase() as AuthenticatedContext["role"],
    tier,
    instanceAdmin: session.user.instanceAdmin,
  };
}

function entitlementIsActive(
  entitlement:
    | { active: boolean; expiresAt: Date | null; tier: "BUDGET" | "ANALYZE" | "OPTIMIZE" }
    | null,
): entitlement is NonNullable<typeof entitlement> {
  return Boolean(
    entitlement?.active && (!entitlement.expiresAt || entitlement.expiresAt.getTime() > Date.now()),
  );
}
