import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { assertRole } from "@/lib/auth/authorize";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { categoryGroupSchema } from "@/lib/budget/schemas";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const context = await requireAuthenticatedContext("budget.read");
    return json(
      await prisma.categoryGroup.findMany({
        where: { householdId: context.householdId, deletedAt: null },
        include: { categories: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } } },
        orderBy: { sortOrder: "asc" },
      }),
    );
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireAuthenticatedContext("budget.write");
    assertRole(context.role, "admin");
    const input = await readJson(request, categoryGroupSchema);
    const group = await prisma.$transaction(async (transaction) => {
      const created = await transaction.categoryGroup.create({
        data: { ...input, householdId: context.householdId },
      });
      await writeAuditEvent(transaction, {
        householdId: context.householdId,
        userId: context.userId,
        action: "category_group.create",
        resourceType: "CategoryGroup",
        resourceId: created.id,
        ipAddress: requestIp(request),
      });
      return created;
    });
    return json(group, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
