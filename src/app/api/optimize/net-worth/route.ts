import { json, readJson, routeError } from "@/lib/api/route";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";
import { computeHoldingPosition, type AssetClass } from "@/lib/optimize/holdings";
import { computeNetWorth, type NetWorthLineInput } from "@/lib/optimize/net-worth";
import { latestAccountPocketBalances, reportingRateMap } from "@/lib/optimize/queries";
import { netWorthSchema } from "@/lib/optimize/schemas";

export async function POST(request: Request) {
  try {
    const context = await requireAuthenticatedContext("optimize.run");
    const input = await readJson(request, netWorthSchema);

    const household = await prisma.household.findUniqueOrThrow({
      where: { id: context.householdId },
      select: { baseCurrency: true },
    });
    const reportingCurrency = household.baseCurrency;

    const [holdings, vehicles, cashBalances, rates] = await Promise.all([
      prisma.holding.findMany({
        where: { householdId: context.householdId, deletedAt: null },
        include: { lots: { orderBy: { acquiredAt: "asc" } } },
        orderBy: { name: "asc" },
      }),
      prisma.pensionVehicle.findMany({
        where: { householdId: context.householdId, deletedAt: null },
        orderBy: { label: "asc" },
      }),
      latestAccountPocketBalances(context.householdId),
      reportingRateMap(context.householdId, reportingCurrency),
    ]);

    const lines: NetWorthLineInput[] = [];

    for (const balance of cashBalances) {
      lines.push({ label: balance.label, category: "cash", currency: balance.currency, amount: balance.balance });
    }

    for (const holding of holdings) {
      const position = computeHoldingPosition({
        id: holding.id,
        name: holding.name,
        symbol: holding.symbol,
        assetClass: holding.assetClass as AssetClass,
        currency: holding.currency,
        unitPrice: holding.unitPrice.toString(),
        lots: holding.lots.map((lot) => ({ quantity: lot.quantity.toString(), unitCost: lot.unitCost.toString() })),
      });
      lines.push({
        label: holding.name,
        category: "investments",
        currency: holding.currency,
        amount: position.marketValue,
      });
    }

    for (const vehicle of vehicles) {
      lines.push({
        label: vehicle.label,
        category: "pension",
        currency: vehicle.currency,
        amount: vehicle.currentBalance.toString(),
      });
    }

    for (const debt of input.debts ?? []) {
      lines.push({ label: debt.name, category: "debt", currency: debt.currency, amount: debt.balance });
    }
    for (const asset of input.additionalAssets ?? []) {
      lines.push({ label: asset.label, category: "other_asset", currency: asset.currency, amount: asset.amount });
    }
    for (const liability of input.additionalLiabilities ?? []) {
      lines.push({ label: liability.label, category: "other_liability", currency: liability.currency, amount: liability.amount });
    }

    const result = computeNetWorth({ reportingCurrency, rates, lines });
    return json({
      ...result,
      sources: {
        cashPockets: cashBalances.length,
        holdings: holdings.length,
        pensionVehicles: vehicles.length,
        debts: input.debts?.length ?? 0,
      },
    });
  } catch (error) {
    return routeError(error);
  }
}
