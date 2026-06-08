import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { toDbAccountType } from "@/lib/budget/db-mapping";
import { accountCreateSchema } from "@/lib/budget/schemas";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const context = await requireAuthenticatedContext("budget.read");
    return json(await prisma.account.findMany({
      where: { householdId: context.householdId, deletedAt: null },
      include: { pockets: { where: { deletedAt: null }, orderBy: { currency: "asc" } } },
      orderBy: { name: "asc" },
    }));
  } catch (error) { return routeError(error); }
}

export async function POST(request: Request) {
  try {
    const context = await requireAuthenticatedContext("budget.write");
    const input = await readJson(request, accountCreateSchema);
    const account = await prisma.$transaction(async (transaction) => {
      const { supportedCurrencies, ...accountInput } = input;
      const created = await transaction.account.create({
        data: {
          ...accountInput,
          type: toDbAccountType(input.type),
          householdId: context.householdId,
          pockets: {
            create: supportedCurrencies.map((currency) => ({
              householdId: context.householdId,
              name: currency,
              currency,
            })),
          },
        },
        include: { pockets: { orderBy: { currency: "asc" } } },
      });
      await writeAuditEvent(transaction, {
        householdId: context.householdId, userId: context.userId, action: "account.create",
        resourceType: "Account", resourceId: created.id,
        metadata: { supportedCurrencies }, ipAddress: requestIp(request),
      });
      return created;
    });
    return json(account, { status: 201 });
  } catch (error) { return routeError(error); }
}
