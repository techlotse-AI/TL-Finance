import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { assertRole } from "@/lib/auth/authorize";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { prisma } from "@/lib/db/prisma";
import { exchangeRateSchema } from "@/lib/money/exchange-rate-schema";

export async function GET() {
  try {
    const context = await requireAuthenticatedContext("budget.read");
    return json(await prisma.exchangeRate.findMany({
      where: { householdId: context.householdId }, orderBy: { asOf: "desc" },
    }));
  } catch (error) { return routeError(error); }
}

export async function POST(request: Request) {
  try {
    const context = await requireAuthenticatedContext("budget.write");
    assertRole(context.role, "admin");
    const input = await readJson(request, exchangeRateSchema);
    const rate = await prisma.$transaction(async (transaction) => {
      const created = await transaction.exchangeRate.create({ data: { ...input, householdId: context.householdId } });
      await writeAuditEvent(transaction, {
        householdId: context.householdId, userId: context.userId, action: "exchange_rate.create",
        resourceType: "ExchangeRate", resourceId: created.id, metadata: { fromCurrency: input.fromCurrency, toCurrency: input.toCurrency, source: input.source },
        ipAddress: requestIp(request),
      });
      return created;
    });
    return json(rate, { status: 201 });
  } catch (error) { return routeError(error); }
}
