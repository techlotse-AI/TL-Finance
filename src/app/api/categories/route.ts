import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { assertRole } from "@/lib/auth/authorize";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { toDbCategoryKind } from "@/lib/budget/db-mapping";
import { requireOwnedCategoryGroup } from "@/lib/budget/ownership";
import { categorySchema } from "@/lib/budget/schemas";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const context = await requireAuthenticatedContext("budget.read");
    return json(await prisma.category.findMany({
      where: { householdId: context.householdId, deletedAt: null },
      include: { group: { select: { name: true } } },
      orderBy: [{ group: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    }));
  } catch (error) { return routeError(error); }
}

export async function POST(request: Request) {
  try {
    const context = await requireAuthenticatedContext("budget.write");
    assertRole(context.role, "admin");
    const input = await readJson(request, categorySchema);
    const category = await prisma.$transaction(async (transaction) => {
      await requireOwnedCategoryGroup(transaction, context.householdId, input.groupId);
      const created = await transaction.category.create({
        data: { ...input, kind: toDbCategoryKind(input.kind), householdId: context.householdId },
      });
      await writeAuditEvent(transaction, {
        householdId: context.householdId, userId: context.userId, action: "category.create",
        resourceType: "Category", resourceId: created.id, ipAddress: requestIp(request),
      });
      return created;
    });
    return json(category, { status: 201 });
  } catch (error) { return routeError(error); }
}
