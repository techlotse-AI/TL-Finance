import { ApiError } from "@/lib/api/errors";
import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { prisma } from "@/lib/db/prisma";
import { computeHoldingPosition, computePortfolio, type AssetClass } from "@/lib/optimize/holdings";
import { reportingRateMap } from "@/lib/optimize/queries";
import { holdingCreateSchema } from "@/lib/optimize/schemas";

export async function GET() {
  try {
    const context = await requireAuthenticatedContext("optimize.read");
    const [household, holdings] = await Promise.all([
      prisma.household.findUniqueOrThrow({
        where: { id: context.householdId },
        select: { baseCurrency: true },
      }),
      prisma.holding.findMany({
        where: { householdId: context.householdId, deletedAt: null },
        include: { lots: { orderBy: { acquiredAt: "asc" } } },
        orderBy: { name: "asc" },
      }),
    ]);

    const positions = holdings.map((holding) =>
      computeHoldingPosition({
        id: holding.id,
        name: holding.name,
        symbol: holding.symbol,
        assetClass: holding.assetClass as AssetClass,
        currency: holding.currency,
        unitPrice: holding.unitPrice.toString(),
        lots: holding.lots.map((lot) => ({
          quantity: lot.quantity.toString(),
          unitCost: lot.unitCost.toString(),
        })),
      }),
    );

    const rates = await reportingRateMap(context.householdId, household.baseCurrency);
    const portfolio = computePortfolio(positions, {
      reportingCurrency: household.baseCurrency,
      rates,
    });
    return json(portfolio);
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireAuthenticatedContext("optimize.run");
    const input = await readJson(request, holdingCreateSchema);

    if (input.accountId) {
      const account = await prisma.account.findFirst({
        where: { id: input.accountId, householdId: context.householdId, deletedAt: null },
        select: { id: true },
      });
      if (!account) {
        throw new ApiError(404, "not_found", "Account not found.");
      }
    }

    const holding = await prisma.$transaction(async (transaction) => {
      const created = await transaction.holding.create({
        data: {
          householdId: context.householdId,
          accountId: input.accountId ?? null,
          name: input.name,
          symbol: input.symbol ?? null,
          assetClass: input.assetClass,
          currency: input.currency,
          unitPrice: input.unitPrice,
          priceAsOf: new Date(),
          lots: {
            create: input.lots.map((lot) => ({
              householdId: context.householdId,
              quantity: lot.quantity,
              unitCost: lot.unitCost,
              acquiredAt: lot.acquiredAt,
            })),
          },
        },
        include: { lots: true },
      });
      await writeAuditEvent(transaction, {
        householdId: context.householdId,
        userId: context.userId,
        action: "optimize.holding.create",
        resourceType: "Holding",
        resourceId: created.id,
        metadata: { assetClass: input.assetClass, currency: input.currency, lots: input.lots.length },
        ipAddress: requestIp(request),
      });
      return created;
    });
    return json(holding, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
