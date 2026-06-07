import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { toDbRecurrence } from "@/lib/budget/db-mapping";
import { requireOwnedPocket } from "@/lib/budget/ownership";
import { plannedTransferSchema } from "@/lib/budget/schemas";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const context = await requireAuthenticatedContext("budget.read");
    return json(await prisma.plannedAccountTransfer.findMany({
      where: { householdId: context.householdId, deletedAt: null },
      include: {
        fromAccountPocket: { include: { account: { select: { name: true } } } },
        toAccountPocket: { include: { account: { select: { name: true } } } },
      },
      orderBy: { name: "asc" },
    }));
  } catch (error) { return routeError(error); }
}

export async function POST(request: Request) {
  try {
    const context = await requireAuthenticatedContext("budget.write");
    const input = await readJson(request, plannedTransferSchema);
    const transfer = await prisma.$transaction(async (transaction) => {
      await requireOwnedPocket(transaction, context.householdId, input.fromAccountPocketId);
      await requireOwnedPocket(transaction, context.householdId, input.toAccountPocketId);
      const created = await transaction.plannedAccountTransfer.create({
        data: {
          ...input, householdId: context.householdId, recurrence: toDbRecurrence(input.recurrence),
        },
      });
      await writeAuditEvent(transaction, {
        householdId: context.householdId, userId: context.userId, action: "planned_transfer.create",
        resourceType: "PlannedAccountTransfer", resourceId: created.id, ipAddress: requestIp(request),
      });
      return created;
    });
    return json(transfer, { status: 201 });
  } catch (error) { return routeError(error); }
}
