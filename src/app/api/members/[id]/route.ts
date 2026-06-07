import { ApiError } from "@/lib/api/errors";
import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { assertRole } from "@/lib/auth/authorize";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { prisma } from "@/lib/db/prisma";
import { updateMemberSchema } from "@/lib/households/schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAuthenticatedContext("budget.write");
    assertRole(context.role, "owner");
    const { id } = await params;
    const input = await readJson(request, updateMemberSchema);
    const member = await prisma.$transaction(async (transaction) => {
      const target = await transaction.householdMember.findFirst({
        where: { id, householdId: context.householdId },
      });
      if (!target) throw new ApiError(404, "not_found", "Household member was not found.");
      if (target.role === "OWNER") throw new ApiError(409, "owner_protected", "The household owner cannot be modified here.");
      const updated = await transaction.householdMember.update({
        where: { id },
        data: {
          role: input.role?.toUpperCase() as "ADMIN" | "MEMBER" | undefined,
          active: input.active,
        },
      });
      if (input.active === false) {
        await transaction.session.updateMany({
          where: { userId: target.userId, activeHouseholdId: context.householdId },
          data: { activeHouseholdId: null },
        });
      }
      await writeAuditEvent(transaction, {
        householdId: context.householdId, userId: context.userId, action: "member.update",
        resourceType: "HouseholdMember", resourceId: id, metadata: input, ipAddress: requestIp(request),
      });
      return updated;
    });
    return json(member);
  } catch (error) { return routeError(error); }
}
