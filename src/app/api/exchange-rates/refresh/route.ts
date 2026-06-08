import { json, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { assertRole } from "@/lib/auth/authorize";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { prisma } from "@/lib/db/prisma";
import { fetchFrankfurterRates } from "@/lib/money/frankfurter";

export async function POST(request: Request) {
  try {
    const context = await requireAuthenticatedContext("budget.write");
    assertRole(context.role, "admin");
    const [household, pockets] = await Promise.all([
      prisma.household.findUniqueOrThrow({
        where: { id: context.householdId },
        select: { baseCurrency: true },
      }),
      prisma.accountPocket.findMany({
        where: {
          householdId: context.householdId,
          active: true,
          deletedAt: null,
          account: { active: true, deletedAt: null },
        },
        select: { currency: true },
      }),
    ]);
    const rates = await fetchFrankfurterRates(
      pockets.map((pocket) => pocket.currency),
      household.baseCurrency,
    );
    await prisma.$transaction(async (transaction) => {
      if (rates.length > 0) {
        await transaction.exchangeRate.createMany({
          data: rates.map((rate) => ({ ...rate, householdId: context.householdId })),
          skipDuplicates: true,
        });
      }
      await writeAuditEvent(transaction, {
        householdId: context.householdId,
        userId: context.userId,
        action: "exchange_rate.refresh",
        resourceType: "ExchangeRate",
        metadata: { provider: "Frankfurter", rateCount: rates.length },
        ipAddress: requestIp(request),
      });
    });
    return json({ rates });
  } catch (error) {
    return routeError(error);
  }
}
