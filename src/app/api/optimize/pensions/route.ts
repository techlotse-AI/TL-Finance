import { json, readJson, routeError } from "@/lib/api/route";
import { writeAuditEvent } from "@/lib/audit/write";
import { requireAuthenticatedContext } from "@/lib/auth/context";
import { requestIp } from "@/lib/auth/request";
import { prisma } from "@/lib/db/prisma";
import { summarizePensions, type CapitalPillar } from "@/lib/optimize/pensions";
import { pensionVehicleCreateSchema } from "@/lib/optimize/schemas";

export async function GET() {
  try {
    const context = await requireAuthenticatedContext("optimize.read");
    const [household, vehicles] = await Promise.all([
      prisma.household.findUniqueOrThrow({
        where: { id: context.householdId },
        select: { baseCurrency: true },
      }),
      prisma.pensionVehicle.findMany({
        where: { householdId: context.householdId, deletedAt: null },
        orderBy: { label: "asc" },
      }),
    ]);

    const baseVehicles = vehicles.filter((vehicle) => vehicle.currency === household.baseCurrency);
    const summary = summarizePensions({
      currency: household.baseCurrency,
      vehicles: baseVehicles.map((vehicle) => ({
        id: vehicle.id,
        label: vehicle.label,
        pillar: vehicle.pillar as CapitalPillar,
        currency: vehicle.currency,
        currentBalance: vehicle.currentBalance.toString(),
        annualContribution: vehicle.annualContribution.toString(),
        annualReturnRate: vehicle.annualReturnRate.toString(),
        yearsToRetirement: vehicle.yearsToRetirement,
      })),
    });
    return json({
      ...summary,
      excludedCurrencyVehicles: vehicles.length - baseVehicles.length,
      vehicles,
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireAuthenticatedContext("optimize.run");
    const input = await readJson(request, pensionVehicleCreateSchema);
    const created = await prisma.$transaction(async (transaction) => {
      const vehicle = await transaction.pensionVehicle.create({
        data: {
          householdId: context.householdId,
          label: input.label,
          pillar: input.pillar,
          currency: input.currency,
          currentBalance: input.currentBalance,
          annualContribution: input.annualContribution,
          annualReturnRate: input.annualReturnRate,
          yearsToRetirement: input.yearsToRetirement,
        },
      });
      await writeAuditEvent(transaction, {
        householdId: context.householdId,
        userId: context.userId,
        action: "optimize.pension.create",
        resourceType: "PensionVehicle",
        resourceId: vehicle.id,
        metadata: { pillar: input.pillar, currency: input.currency },
        ipAddress: requestIp(request),
      });
      return vehicle;
    });
    return json(created, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
