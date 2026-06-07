import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { requireOwnedAccount } from "@/lib/budget/ownership";
import { accountPocketSchema } from "@/lib/budget/schemas";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const context = await requireAuthenticatedContext("budget.read");
    return json(await prisma.accountPocket.findMany({
      where: { householdId: context.householdId, deletedAt: null, account: { deletedAt: null } },
      include: { account: { select: { name: true, type: true } } },
      orderBy: [{ account: { name: "asc" } }, { currency: "asc" }],
    }));
  } catch (error) { return routeError(error); }
}

export async function POST(request: Request) {
  try {
    const context = await requireAuthenticatedContext("budget.write");
    const input = await readJson(request, accountPocketSchema);
    const pocket = await prisma.$transaction(async (transaction) => {
      await requireOwnedAccount(transaction, context.householdId, input.accountId);
      const created = await transaction.accountPocket.create({
        data: { ...input, householdId: context.householdId },
      });
      await writeAuditEvent(transaction, {
        householdId: context.householdId, userId: context.userId, action: "account_pocket.create",
        resourceType: "AccountPocket", resourceId: created.id, ipAddress: requestIp(request),
      });
      return created;
    });
    return json(pocket, { status: 201 });
  } catch (error) { return routeError(error); }
}
