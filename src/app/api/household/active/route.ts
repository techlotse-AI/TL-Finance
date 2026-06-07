import { ApiError } from "@/lib/api/errors";
import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedSession } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { prisma } from "@/lib/db/prisma";
import { selectHouseholdSchema } from "@/lib/households/schemas";

export async function POST(request: Request) {
  try {
    const session = await requireAuthenticatedSession();
    const input = await readJson(request, selectHouseholdSchema);
    const membership = await prisma.householdMember.findFirst({
      where: {
        householdId: input.householdId,
        userId: session.userId,
        active: true,
        household: { active: true },
      },
      select: { householdId: true },
    });

    if (!membership) throw new ApiError(403, "forbidden", "Household access is not available.");

    await prisma.$transaction(async (transaction) => {
      await transaction.session.update({
        where: { id: session.sessionId },
        data: { activeHouseholdId: input.householdId },
      });
      await writeAuditEvent(transaction, {
        householdId: input.householdId,
        userId: session.userId,
        action: "household.select",
        resourceType: "Household",
        resourceId: input.householdId,
        ipAddress: requestIp(request),
      });
    });
    return json({ activeHouseholdId: input.householdId });
  } catch (error) {
    return routeError(error);
  }
}
