import { ApiError } from "@/lib/api/errors";
import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { assertRole } from "@/lib/auth/authorize";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { prisma } from "@/lib/db/prisma";
import { addMemberSchema } from "@/lib/households/schemas";

export async function GET() {
  try {
    const context = await requireAuthenticatedContext("budget.read");
    return json(await prisma.householdMember.findMany({
      where: { householdId: context.householdId },
      select: {
        id: true, role: true, active: true, createdAt: true,
        user: { select: { id: true, email: true, displayName: true } },
      },
      orderBy: { createdAt: "asc" },
    }));
  } catch (error) { return routeError(error); }
}

export async function POST(request: Request) {
  try {
    const context = await requireAuthenticatedContext("budget.write");
    assertRole(context.role, "admin");
    const input = await readJson(request, addMemberSchema);
    const member = await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.findUnique({ where: { email: input.email }, select: { id: true } });
      if (!user) throw new ApiError(404, "user_not_found", "The user must create an account before being added.");
      const created = await transaction.householdMember.upsert({
        where: { householdId_userId: { householdId: context.householdId, userId: user.id } },
        create: { householdId: context.householdId, userId: user.id, role: input.role.toUpperCase() as "ADMIN" | "MEMBER" },
        update: { active: true, role: input.role.toUpperCase() as "ADMIN" | "MEMBER" },
        select: { id: true, userId: true, role: true, active: true },
      });
      await writeAuditEvent(transaction, {
        householdId: context.householdId, userId: context.userId, action: "member.add",
        resourceType: "HouseholdMember", resourceId: created.id, metadata: { targetUserId: user.id, role: input.role },
        ipAddress: requestIp(request),
      });
      return created;
    });
    return json(member, { status: 201 });
  } catch (error) { return routeError(error); }
}
