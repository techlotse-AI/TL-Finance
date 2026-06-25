import { ApiError } from "@/lib/api/errors";
import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedSession } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { prisma } from "@/lib/db/prisma";
import { adminHouseholdMemberRemoveSchema, adminHouseholdMemberSchema } from "@/lib/platform/schemas";

/** Assign (or re-activate) a user's membership in any household. Instance admin only. */
export async function POST(request: Request) {
  try {
    const session = await requireAuthenticatedSession();
    if (!session.instanceAdmin) throw new ApiError(403, "forbidden", "Instance administrator access is required.");
    const input = await readJson(request, adminHouseholdMemberSchema);
    const role = input.role.toUpperCase() as "ADMIN" | "MEMBER";

    const member = await prisma.$transaction(async (transaction) => {
      const [household, user] = await Promise.all([
        transaction.household.findFirst({ where: { id: input.householdId, active: true }, select: { id: true } }),
        transaction.user.findUnique({ where: { id: input.userId }, select: { id: true } }),
      ]);
      if (!household) throw new ApiError(404, "not_found", "Household not found.");
      if (!user) throw new ApiError(404, "not_found", "User not found.");

      const existing = await transaction.householdMember.findUnique({
        where: { householdId_userId: { householdId: input.householdId, userId: input.userId } },
        select: { role: true },
      });
      if (existing?.role === "OWNER") {
        throw new ApiError(409, "owner_protected", "The household owner role cannot be changed here.");
      }

      const upserted = await transaction.householdMember.upsert({
        where: { householdId_userId: { householdId: input.householdId, userId: input.userId } },
        create: { householdId: input.householdId, userId: input.userId, role },
        update: { active: true, role },
        select: { id: true, householdId: true, userId: true, role: true, active: true },
      });
      await writeAuditEvent(transaction, {
        householdId: input.householdId,
        userId: session.userId,
        action: "platform.member.assign",
        resourceType: "HouseholdMember",
        resourceId: upserted.id,
        metadata: { targetUserId: input.userId, role },
        ipAddress: requestIp(request),
      });
      return upserted;
    });
    return json(member, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}

/** Remove (deactivate) a user's membership in any household. Instance admin only. */
export async function DELETE(request: Request) {
  try {
    const session = await requireAuthenticatedSession();
    if (!session.instanceAdmin) throw new ApiError(403, "forbidden", "Instance administrator access is required.");
    const input = await readJson(request, adminHouseholdMemberRemoveSchema);

    const removed = await prisma.$transaction(async (transaction) => {
      const target = await transaction.householdMember.findUnique({
        where: { householdId_userId: { householdId: input.householdId, userId: input.userId } },
        select: { id: true, role: true, active: true },
      });
      if (!target) throw new ApiError(404, "not_found", "Membership not found.");
      if (target.role === "OWNER") {
        throw new ApiError(409, "owner_protected", "The household owner cannot be removed.");
      }
      const updated = await transaction.householdMember.update({
        where: { householdId_userId: { householdId: input.householdId, userId: input.userId } },
        data: { active: false },
        select: { id: true },
      });
      // Drop the active-household pointer for any of the user's sessions in this household.
      await transaction.session.updateMany({
        where: { userId: input.userId, activeHouseholdId: input.householdId },
        data: { activeHouseholdId: null },
      });
      await writeAuditEvent(transaction, {
        householdId: input.householdId,
        userId: session.userId,
        action: "platform.member.remove",
        resourceType: "HouseholdMember",
        resourceId: updated.id,
        metadata: { targetUserId: input.userId },
        ipAddress: requestIp(request),
      });
      return updated;
    });
    return json(removed);
  } catch (error) {
    return routeError(error);
  }
}
