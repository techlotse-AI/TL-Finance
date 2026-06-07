import { ApiError } from "@/lib/api/errors";
import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedSession } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { prisma } from "@/lib/db/prisma";
import { tierAssignmentSchema } from "@/lib/households/schemas";

export async function GET() {
  try {
    const session = await requireAuthenticatedSession();
    if (!session.instanceAdmin) throw new ApiError(403, "forbidden", "Instance administrator access is required.");
    return json(await prisma.household.findMany({
      where: { active: true },
      select: { id: true, name: true, baseCurrency: true, entitlement: true },
      orderBy: { name: "asc" },
    }));
  } catch (error) { return routeError(error); }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuthenticatedSession();
    if (!session.instanceAdmin) throw new ApiError(403, "forbidden", "Instance administrator access is required.");
    const input = await readJson(request, tierAssignmentSchema);
    const household = await prisma.household.findFirst({ where: { id: input.householdId, active: true }, select: { id: true } });
    if (!household) throw new ApiError(404, "not_found", "Household was not found.");
    const entitlement = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.tierEntitlement.upsert({
        where: { householdId: input.householdId },
        create: {
          householdId: input.householdId, tier: input.tier.toUpperCase() as "BUDGET" | "ANALYZE" | "OPTIMIZE",
          active: input.active, expiresAt: input.expiresAt, source: "manual", assignedBy: session.userId,
        },
        update: {
          tier: input.tier.toUpperCase() as "BUDGET" | "ANALYZE" | "OPTIMIZE",
          active: input.active, expiresAt: input.expiresAt, source: "manual", assignedBy: session.userId,
        },
      });
      await writeAuditEvent(transaction, {
        householdId: input.householdId, userId: session.userId, action: "tier.assign",
        resourceType: "TierEntitlement", resourceId: updated.id, metadata: { tier: input.tier, active: input.active },
        ipAddress: requestIp(request),
      });
      return updated;
    });
    return json(entitlement);
  } catch (error) { return routeError(error); }
}
